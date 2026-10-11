import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ragSql } from "@/lib/rag/db";
import { UUID } from "@/lib/rag/core";
import { generateHardQuiz } from "@/lib/rag/materials";
import { DAILY_LIMIT } from "@/lib/daily-limit";
import { recordCompletedQuizGeneration } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const quizId = (await context.params).id;
    if (!UUID.test(quizId)) return NextResponse.json({ success: false, error: "ID quiz tidak valid." }, { status: 400 });
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ success: false, error: "Silakan login terlebih dahulu.", requireAuth: true }, { status: 401 });
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() || crypto.randomUUID();
    if (idempotencyKey.length > 200) return NextResponse.json({ success: false, error: "Idempotency-Key tidak valid." }, { status: 400 });
    const [quiz] = await ragSql()`select qs.id,qs.document_id,d.title,d.content_language
      from public.quiz_sets qs join public.documents d on d.id=qs.document_id
      where qs.id=${quizId} and d.user_id=${session.user.id} and d.deleted_at is null`;
    if (!quiz) return NextResponse.json({ success: false, error: "Quiz tidak ditemukan." }, { status: 404 });
    const sql = ragSql();
    const eventKey = `quiz_extra:level-up:${quizId}:${idempotencyKey}`;
    const [existing] = await sql`select e.quiz_set_id,e.remaining_quota,qs.label,(select count(*) from public.quiz_questions q where q.quiz_set_id=e.quiz_set_id) question_count
      from public.generation_quota_events e left join public.quiz_sets qs on qs.id=e.quiz_set_id where e.user_id=${session.user.id} and e.event_key=${eventKey}`;
    if (existing?.quiz_set_id) {
      const existingSet = { id: String(existing.quiz_set_id), label: String(existing.label ?? "Lebih Sulit"), questionCount: Number(existing.question_count ?? 0) };
      await recordCompletedQuizGeneration({
        userId: session.user.id,
        documentId: String(quiz.document_id),
        quizSetId: existingSet.id,
        quizSetLabel: existingSet.label,
        questionCount: existingSet.questionCount,
        remainingQuota: Number(existing.remaining_quota),
        idempotencyKey: eventKey,
        variant: "harder",
        sourceQuizSetId: quizId,
      });
      return NextResponse.json({ success: true, quizSet: existingSet, generatedAdditional: 0, remainingToday: Number(existing.remaining_quota) }, { status: 200 });
    }
    const baseQuestions = await sql`select question from public.quiz_questions where quiz_set_id=${quizId} and document_id=${quiz.document_id} order by id`;
    const previous = await sql`select question from public.quiz_questions where document_id=${quiz.document_id} order by id`;
    const cards = await sql`select term,definition from public.flashcards where document_id=${quiz.document_id} order by id`;
    if (!cards.length) return NextResponse.json({ success: false, error: "Flashcard belum tersedia sebagai konteks materi." }, { status: 409 });
    const targetCount = Math.max(5, Math.min(20, baseQuestions.length || 5));
    const allQuestions = await generateHardQuiz(
      cards.map(card => ({ term: String(card.term), definition: String(card.definition) })),
      targetCount,
      String(quiz.content_language ?? "auto"),
      previous.map(item => String(item.question)),
    );
    const [result] = await sql`select private.create_quiz_extra_generation(
      ${session.user.id},${String(quiz.document_id)},'Lebih Sulit',${sql.json(allQuestions as unknown as never)},${eventKey},${DAILY_LIMIT}) as value`;
    const value = result?.value as { id: string; label: string; question_count: number; remaining: number; created: boolean };
    await recordCompletedQuizGeneration({
      userId: session.user.id,
      documentId: String(quiz.document_id),
      quizSetId: value.id,
      quizSetLabel: value.label,
      questionCount: value.question_count,
      remainingQuota: value.remaining,
      idempotencyKey: eventKey,
      variant: "harder",
      sourceQuizSetId: quizId,
    });
    return NextResponse.json({ success: true, quizSet: { id: value.id, label: value.label, questionCount: value.question_count }, generatedAdditional: value.created ? allQuestions.length : 0, remainingToday: value.remaining, message: `A harder quiz set was created (${value.label}).` }, { status: value.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("DAILY_LIMIT_REACHED")) return NextResponse.json({ success: false, error: "Limit harian sudah tercapai. Coba lagi besok.", limitReached: true, remainingToday: 0, dailyLimit: DAILY_LIMIT }, { status: 429 });
    console.error("[quiz/level-up]", { errorType: error instanceof Error ? error.name : "Unknown" });
    return NextResponse.json({ success: false, error: "Quiz level-up gagal dibuat." }, { status: 500 });
  }
}
