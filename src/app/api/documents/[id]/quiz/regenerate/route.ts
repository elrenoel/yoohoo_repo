import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/auth-guard";
import { ragSql } from "@/lib/rag/db";
import { UUID } from "@/lib/rag/core";
import { generateQuizQuestions } from "@/lib/ai";
import { DAILY_LIMIT } from "@/lib/daily-limit";
import { generateRepresentativeQuiz, representativeQuizCount } from "@/lib/rag/materials";
import { recordCompletedQuizGeneration } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const { id } = await props.params;
    if (!UUID.test(id)) return NextResponse.json({ success: false, error: "ID dokumen tidak valid." }, { status: 400 });
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ success: false, error: "Silakan masuk terlebih dahulu.", requireAuth: true }, { status: 401 });
    const key = request.headers.get("idempotency-key")?.trim() || crypto.randomUUID();
    if (key.length > 200) return NextResponse.json({ success: false, error: "Idempotency-Key tidak valid." }, { status: 400 });
    const sql = ragSql();
    const [doc] = await sql`select id,title,raw_text,content_language from public.documents where id=${id} and user_id=${session.user.id} and deleted_at is null`;
    if (!doc) return NextResponse.json({ success: false, error: "Dokumen tidak ditemukan." }, { status: 404 });
    const eventKey = `quiz_extra:regenerate:${id}:${key}`;
    const [existing] = await sql`select e.quiz_set_id, e.remaining_quota, qs.label, (select count(*) from public.quiz_questions q where q.quiz_set_id=e.quiz_set_id) question_count
      from public.generation_quota_events e left join public.quiz_sets qs on qs.id=e.quiz_set_id
      where e.user_id=${session.user.id} and e.event_key=${eventKey}`;
    if (existing?.quiz_set_id) {
      const existingSet = { id: String(existing.quiz_set_id), label: String(existing.label ?? "Soal Berbeda"), questionCount: Number(existing.question_count ?? 0) };
      await recordCompletedQuizGeneration({
        userId: session.user.id,
        documentId: id,
        quizSetId: existingSet.id,
        quizSetLabel: existingSet.label,
        questionCount: existingSet.questionCount,
        remainingQuota: Number(existing.remaining_quota),
        idempotencyKey: eventKey,
        variant: "different",
      });
      return NextResponse.json({ success: true, quizSet: existingSet, remainingToday: Number(existing.remaining_quota), message: "This quiz set is already available." }, { status: 200 });
    }
    const rawText = String(doc.raw_text ?? "").trim();
    const previous = await sql`select question from public.quiz_questions where document_id=${id} order by id`;
    const previousQuestions = previous.map(item => String(item.question));
    let questions: Awaited<ReturnType<typeof generateQuizQuestions>>["quiz"] | Awaited<ReturnType<typeof generateRepresentativeQuiz>>;
    if (rawText) {
      questions = (await generateQuizQuestions(rawText, doc.content_language ?? undefined, previousQuestions)).quiz;
    } else {
      // Dokumen dari pipeline RAG menyimpan sumber di chunks, sehingga raw_text
      // dapat kosong. Flashcard yang sudah tervalidasi menjadi sumber quiz yang
      // aman dan konsisten dengan materi yang sedang dipelajari.
      const cards = await sql`select term,definition from public.flashcards
        where document_id=${id} order by id`;
      if (!cards.length) return NextResponse.json({ success: false, error: "Belum ada flashcard yang dapat dijadikan sumber quiz." }, { status: 409 });
      questions = await generateRepresentativeQuiz(
        cards.map(card => ({ term: String(card.term), definition: String(card.definition) })),
        representativeQuizCount(cards.length),
        String(doc.content_language ?? "auto"),
        previousQuestions,
      );
    }
    const [saved] = await sql`select private.create_quiz_extra_generation(${session.user.id},${id},${"Soal Berbeda"},${sql.json(questions as unknown as never)},${eventKey},${DAILY_LIMIT}) as value`;
    const value = saved.value as { id: string; label: string; question_count: number; remaining: number; created: boolean };
    await recordCompletedQuizGeneration({
      userId: session.user.id,
      documentId: id,
      quizSetId: value.id,
      quizSetLabel: value.label,
      questionCount: value.question_count,
      remainingQuota: value.remaining,
      idempotencyKey: eventKey,
      variant: "different",
    });
    return NextResponse.json({ success: true, quizSet: { id: value.id, label: value.label, questionCount: value.question_count }, remainingToday: value.remaining, message: `A new question set was created (${value.label}).` }, { status: value.created ? 201 : 200 });
  } catch (error) {
    console.error("[quiz/regenerate]", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.message.includes("DAILY_LIMIT_REACHED")) return NextResponse.json({ success: false, error: "Limit harian sudah tercapai. Coba lagi besok.", limitReached: true, remainingToday: 0, dailyLimit: DAILY_LIMIT }, { status: 429 });
    if (error instanceof Error && error.message.includes("DOCUMENT_NOT_FOUND")) return NextResponse.json({ success: false, error: "Dokumen tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ success: false, error: "Gagal membuat quiz baru." }, { status: 500 });
  }
}
