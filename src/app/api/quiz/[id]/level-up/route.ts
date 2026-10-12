import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/auth-guard";
import { ragSql } from "@/lib/rag/db";
import { UUID } from "@/lib/rag/core";
import { generateHardQuiz } from "@/lib/rag/materials";
import { DAILY_LIMIT } from "@/lib/daily-limit";
import { recordCompletedQuizGeneration } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const quizId = (await context.params).id;
    if (!UUID.test(quizId)) return NextResponse.json({ success: false, error: "ID quiz tidak valid." }, { status: 400 });
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ success: false, error: "Silakan login terlebih dahulu.", requireAuth: true }, { status: 401 });
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() || crypto.randomUUID();
    if (idempotencyKey.length > 200) return NextResponse.json({ success: false, error: "Idempotency-Key tidak valid." }, { status: 400 });
    const [quiz] = await ragSql()`select qs.id,qs.document_id,qs.group_id,coalesce(d.title,g.name) title,
      coalesce(d.content_language,(select source.content_language from public.flashcards f join public.documents source on source.id=f.source_document_id where f.group_id=qs.group_id limit 1),'auto') content_language,
      coalesce(qs.document_id,(select min(f.source_document_id) from public.flashcards f where f.group_id=qs.group_id)) source_document_id
      from public.quiz_sets qs left join public.documents d on d.id=qs.document_id left join public.flashcard_groups g on g.id=qs.group_id
      where qs.id=${quizId} and ((d.user_id=${session.user.id} and d.deleted_at is null) or g.user_id=${session.user.id})`;
    if (!quiz) return NextResponse.json({ success: false, error: "Quiz tidak ditemukan." }, { status: 404 });
    const sql = ragSql();
    const eventKey = `quiz_extra:level-up:${quizId}:${idempotencyKey}`;
    const [existing] = await sql`select e.quiz_set_id,e.remaining_quota,qs.label,(select count(*) from public.quiz_questions q where q.quiz_set_id=e.quiz_set_id) question_count
      from public.generation_quota_events e left join public.quiz_sets qs on qs.id=e.quiz_set_id where e.user_id=${session.user.id} and e.event_key=${eventKey}`;
    if (existing?.quiz_set_id) {
      const existingSet = { id: String(existing.quiz_set_id), label: String(existing.label ?? "Lebih Sulit"), questionCount: Number(existing.question_count ?? 0) };
      await recordCompletedQuizGeneration({
        userId: session.user.id,
        documentId: String(quiz.source_document_id),
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
    const baseQuestions = await sql`select question from public.quiz_questions where quiz_set_id=${quizId} order by id`;
    const previous = quiz.group_id
      ? await sql`select q.question from public.quiz_questions q join public.quiz_sets qs on qs.id=q.quiz_set_id where qs.group_id=${quiz.group_id} order by q.id`
      : await sql`select question from public.quiz_questions where document_id=${quiz.document_id} order by id`;
    const cards = quiz.group_id
      ? await sql`select term,definition from public.flashcards where group_id=${quiz.group_id} order by id`
      : await sql`select term,definition from public.flashcards where document_id=${quiz.document_id} order by id`;
    if (!cards.length) return NextResponse.json({ success: false, error: "Flashcard belum tersedia sebagai konteks materi." }, { status: 409 });
    const targetCount = Math.max(5, Math.min(20, baseQuestions.length || 5));
    const allQuestions = await generateHardQuiz(
      cards.map(card => ({ term: String(card.term), definition: String(card.definition) })),
      targetCount,
      String(quiz.content_language ?? "auto"),
      previous.map(item => String(item.question)),
    );
    if (quiz.group_id) {
      const value = await sql.begin(async tx=>{
        const [quota]=await tx`select * from private.consume_generation_quota_event(${session.user.id},${eventKey},'quiz_extra',${DAILY_LIMIT},${quiz.source_document_id})`;
        const[set]=await tx`insert into public.quiz_sets(document_id,group_id,label) values(null,${quiz.group_id},'Lebih Sulit') returning id,label`;
        await tx`update public.generation_quota_events set quiz_set_id=${set.id} where id=${quota.event_id}`;
        for(const question of allQuestions)await tx`insert into public.quiz_questions(document_id,quiz_set_id,question,options,correct_index,explanation,difficulty) values(${quiz.source_document_id},${set.id},${question.question},${tx.json(question.options)},${question.correct_index},${question.explanation},${question.difficulty})`;
        const[job]=await tx`insert into public.generation_jobs(user_id,kind,status,deck_id,document_id,input,result,idempotency_key,selected_keyword_ids,expected_items,quota_count,remaining_quota,flashcard_count,quiz_count,attempts,started_at,finished_at,completed_at) select ${session.user.id},'quiz_generate','succeeded',g.deck_id,null,${tx.json({variant:'harder',sourceQuizSetId:quizId,groupId:String(quiz.group_id)})},${tx.json({quizSetId:String(set.id),quizSetLabel:String(set.label),questionCount:allQuestions.length})},${eventKey},array[]::uuid[],${allQuestions.length},1,${Number(quota.remaining)},0,${allQuestions.length},1,now(),now(),now() from public.flashcard_groups g where g.id=${quiz.group_id} returning id`;
        await tx`update public.quiz_sets set job_id=${job.id} where id=${set.id}`;
        return{id:String(set.id),label:String(set.label),question_count:allQuestions.length,remaining:Number(quota.remaining),created:true};
      });
      return NextResponse.json({success:true,quizSet:{id:value.id,label:value.label,questionCount:value.question_count},generatedAdditional:allQuestions.length,remainingToday:value.remaining,message:`A harder quiz set was created (${value.label}).`},{status:201});
    }
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
