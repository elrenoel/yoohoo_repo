import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ragSql } from "@/lib/rag/db";
import { UUID } from "@/lib/rag/core";

const modes = new Set(["normal", "time_attack"]);
const statuses = new Set(["answered", "skipped", "timeout"]);
type AnswerInput = { question_id?: unknown; selected_index?: unknown; time_taken_ms?: unknown; status?: unknown };

function bad(message: string, status = 400) { return NextResponse.json({ success: false, error: message }, { status }); }

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const quizId = (await context.params).id;
    if (!UUID.test(quizId)) return bad("ID quiz tidak valid.");
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return bad("Silakan login terlebih dahulu.", 401);
    const body = await request.json().catch(() => null) as { mode?: unknown; answers?: unknown; session_id?: unknown } | null;
    const mode = body?.mode;
    if (typeof mode !== "string" || !modes.has(mode)) return bad("Mode harus normal atau time_attack.");
    if (!Array.isArray(body?.answers) || body.answers.length === 0 || body.answers.length > 100) return bad("Array answers wajib berisi 1-100 jawaban.");
    const answers = body.answers as AnswerInput[];
    const parsed = answers.map((answer) => {
      const questionId = typeof answer.question_id === "string" ? answer.question_id : "";
      const status = typeof answer.status === "string" ? answer.status : "";
      const selected = answer.selected_index === null || answer.selected_index === undefined ? null : answer.selected_index;
      const timeTaken = answer.time_taken_ms === null || answer.time_taken_ms === undefined ? null : answer.time_taken_ms;
      if (!UUID.test(questionId) || !statuses.has(status)) throw new Error("FORMAT_ANSWER");
      if (selected !== null && (!Number.isInteger(selected) || Number(selected) < 0 || Number(selected) > 3)) throw new Error("FORMAT_ANSWER");
      if (timeTaken !== null && (!Number.isInteger(timeTaken) || Number(timeTaken) < 0 || Number(timeTaken) > 86_400_000)) throw new Error("FORMAT_ANSWER");
      if (status === "answered" && selected === null) throw new Error("FORMAT_ANSWER");
      return { questionId, selectedIndex: selected === null ? null : Number(selected), timeTakenMs: timeTaken === null ? null : Number(timeTaken), status };
    });
    if (new Set(parsed.map(answer => answer.questionId)).size !== parsed.length) return bad("Satu soal hanya boleh memiliki satu jawaban.");

    const result = await ragSql().begin(async sql => {
      const [quiz] = await sql`select qs.id,qs.document_id,d.title
        from public.quiz_sets qs join public.documents d on d.id=qs.document_id
        where qs.id=${quizId} and d.user_id=${session.user.id} and d.deleted_at is null`;
      if (!quiz) throw new Error("QUIZ_NOT_FOUND");
      const questions = await sql`select id,question,options,correct_index from public.quiz_questions
        where quiz_set_id=${quizId} and document_id=${quiz.document_id}`;
      const byId = new Map(questions.map(question => [String(question.id), Number(question.correct_index)]));
      const questionById = new Map(questions.map(question => [String(question.id), question]));
      if (parsed.some(answer => !byId.has(answer.questionId))) throw new Error("QUESTION_NOT_FOUND");
      const rows = parsed.map(answer => ({ ...answer, isCorrect: answer.status === "answered" && answer.selectedIndex === byId.get(answer.questionId) }));
      const score = rows.filter(answer => answer.isCorrect).length;
      const totalTimeMs = rows.reduce((sum, answer) => sum + (answer.timeTakenMs ?? 0), 0);
      const [attempt] = await sql`insert into public.quiz_attempts(document_id,session_id,score,total,answers,quiz_set_id,mode,total_time_ms)
        values (${quiz.document_id},${typeof body?.session_id === "string" ? body.session_id : null},${score},${questions.length},${sql.json(rows.map(answer => ({ questionId: answer.questionId, selectedIndex: answer.selectedIndex, isCorrect: answer.isCorrect, timeTakenMs: answer.timeTakenMs, status: answer.status })) )},${quizId},${mode},${totalTimeMs})
        returning id,created_at`;
      await sql`insert into public.quiz_attempt_answers ${sql(rows.map(answer => ({ attempt_id: attempt.id, question_id: answer.questionId, selected_index: answer.selectedIndex, is_correct: answer.isCorrect, time_taken_ms: answer.timeTakenMs, status: answer.status })), "attempt_id", "question_id", "selected_index", "is_correct", "time_taken_ms", "status")}`;
      const review = rows.map(answer => {
        const question = questionById.get(answer.questionId);
        return {
          questionId: answer.questionId,
          question: String(question?.question ?? ""),
          options: Array.isArray(question?.options) ? question.options : [],
          selectedIndex: answer.selectedIndex,
          correctIndex: Number(question?.correct_index ?? -1),
          isCorrect: answer.isCorrect,
        };
      });
      return {
        attemptId: String(attempt.id),
        quizId,
        score,
        total: questions.length,
        percentage: questions.length ? Math.round((score / questions.length) * 100) : 0,
        totalTimeMs,
        createdAt: attempt.created_at,
        documentTitle: quiz.title,
        review,
      };
    });
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "FORMAT_ANSWER") return bad("Format jawaban tidak valid.");
    if (message === "QUIZ_NOT_FOUND") return bad("Quiz tidak ditemukan.", 404);
    if (message === "QUESTION_NOT_FOUND") return bad("Ada soal yang bukan bagian dari quiz ini.", 400);
    console.error("[quiz/attempts]", { errorType: error instanceof Error ? error.name : "Unknown" });
    return bad("Jawaban quiz gagal disimpan.", 500);
  }
}
