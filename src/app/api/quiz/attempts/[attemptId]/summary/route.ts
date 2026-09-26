import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ragSql } from "@/lib/rag/db";
import { UUID } from "@/lib/rag/core";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ attemptId: string }> }) {
  try {
    const { attemptId } = await context.params;
    if (!UUID.test(attemptId)) return NextResponse.json({ success: false, error: "ID attempt tidak valid." }, { status: 400 });
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ success: false, error: "Silakan login terlebih dahulu.", requireAuth: true }, { status: 401 });
    const [attempt] = await ragSql()`select a.id,a.document_id,a.quiz_set_id,a.score,a.total,a.created_at,d.title
      from public.quiz_attempts a join public.documents d on d.id=a.document_id
      where a.id=${attemptId} and d.user_id=${session.user.id} and d.deleted_at is null`;
    if (!attempt) return NextResponse.json({ success: false, error: "Attempt tidak ditemukan." }, { status: 404 });

    const [metrics] = await ragSql()`with question_stats as (
        select q.difficulty, q.id, coalesce(aa.is_correct,false) as is_correct,
          coalesce(aa.status,'skipped') as status, aa.time_taken_ms
        from public.quiz_questions q
        left join public.quiz_attempt_answers aa on aa.question_id=q.id and aa.attempt_id=${attemptId}
        where q.quiz_set_id=${attempt.quiz_set_id} and q.document_id=${attempt.document_id}
      ), by_difficulty as (
        select difficulty, count(*)::int as total, count(*) filter (where is_correct)::int as correct
        from question_stats group by difficulty
      ), historical_attempt_times as (
        select a.id, avg(aa.time_taken_ms) filter (where aa.status='answered' and aa.time_taken_ms is not null) as avg_time
        from public.quiz_attempts a join public.quiz_attempt_answers aa on aa.attempt_id=a.id
        where a.quiz_set_id=${attempt.quiz_set_id} and a.id<>${attemptId}
        group by a.id
      )
      select
        (select count(*) filter (where is_correct)::int from question_stats) as correct_count,
        (select avg(time_taken_ms) filter (where status='answered' and time_taken_ms is not null) from question_stats) as avg_time_per_question,
        (select count(*) filter (where status in ('timeout','skipped'))::int from question_stats) as timeout_or_skip_count,
        coalesce((select jsonb_object_agg(difficulty, jsonb_build_object('correct',correct,'total',total,'accuracy',round(correct::numeric/nullif(total,0),4))) from by_difficulty),'{}'::jsonb) as breakdown_by_difficulty,
        (select count(*) filter (where avg_time is not null)::int from historical_attempt_times) as historical_attempt_count,
        (select avg(avg_time) from historical_attempt_times) as historical_avg_time`;

    const total = Number(attempt.total) || 0;
    const correct = Number(metrics?.correct_count) || 0;
    const accuracy = total ? correct / total : 0;
    const avgTime = metrics?.avg_time_per_question === null || metrics?.avg_time_per_question === undefined ? null : Number(metrics.avg_time_per_question);
    const timeoutOrSkipRate = total ? (Number(metrics?.timeout_or_skip_count) || 0) / total : 0;
    const historicalCount = Number(metrics?.historical_attempt_count) || 0;
    const historicalAvg = metrics?.historical_avg_time === null || metrics?.historical_avg_time === undefined ? null : Number(metrics.historical_avg_time);
    const wrongAnswers = await ragSql()`select q.id as question_id,q.question,q.options,q.correct_index,q.explanation,
        aa.selected_index,aa.status
      from public.quiz_attempt_answers aa join public.quiz_questions q on q.id=aa.question_id
      where aa.attempt_id=${attemptId} and aa.is_correct is false order by q.id`;
    const fast = avgTime !== null && (historicalCount >= 10 ? historicalAvg !== null && avgTime < historicalAvg : avgTime < 15_000);
    const suggestion = accuracy >= 0.8 && fast
      ? { type: "level_up", message: "Kamu kayaknya udah kuasai materi ini — mau coba level yang lebih susah?" }
      : accuracy < 0.5 || timeoutOrSkipRate > 0.3
        ? { type: "review_material", message: "Kayaknya materi ini masih perlu dipelajari ulang. Mau balik ke flashcard dulu?" }
        : { type: "review_or_continue", message: "Hasil yang solid, tapi masih ada ruang buat lebih baik. Mau review bagian yang salah dulu?" };
    return NextResponse.json({ success: true, attempt: { id: attempt.id, quizId: attempt.quiz_set_id, documentId: attempt.document_id, score: Number(attempt.score), total, createdAt: attempt.created_at }, accuracy, avg_time_per_question: avgTime, timeout_or_skip_rate: timeoutOrSkipRate, breakdown_by_difficulty: metrics?.breakdown_by_difficulty ?? {}, wrong_answers: wrongAnswers.map(item => ({ question_id: String(item.question_id), question: String(item.question), options: Array.isArray(item.options) ? item.options : [], selected_index: item.selected_index === null ? -1 : Number(item.selected_index), correct_index: Number(item.correct_index), explanation: item.explanation ? String(item.explanation) : null, status: String(item.status) })), historical_attempt_count: historicalCount, historical_avg_time_per_question: historicalAvg, suggestion });
  } catch (error) {
    console.error("[quiz/attempts/summary]", { errorType: error instanceof Error ? error.name : "Unknown" });
    return NextResponse.json({ success: false, error: "Ringkasan quiz gagal dimuat." }, { status: 500 });
  }
}
