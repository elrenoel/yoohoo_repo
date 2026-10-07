import { ragSql } from "@/lib/rag/db";
import { RagError, UUID } from "@/lib/rag/core";
import { ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

/**
 * GET /api/jobs/:id — status job untuk polling UI (milik user sendiri).
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const rawId = (await context.params).id;
    if (!UUID.test(rawId)) throw new RagError("ID proses tidak valid.");
    const [job] = await ragSql()`
      select id, kind, status, error_message, deck_id, document_id,
        flashcard_count, quiz_count, expected_items, created_at, started_at,
        finished_at, completed_at
      from public.generation_jobs
      where id=${rawId} and user_id=${userId}`;
    if (!job) throw new RagError("Proses generate tidak ditemukan.", 404);
    const [counts] = await ragSql()`
      select count(*) filter (where status = 'completed')::int as completed,
             count(*)::int as total
      from public.generation_job_items where job_id=${rawId}`;
    return Response.json({
      job: {
        id: String(job.id), kind: String(job.kind), status: String(job.status),
        errorMessage: job.error_message as string | null,
        deckId: job.deck_id ? String(job.deck_id) : null,
        documentId: job.document_id ? String(job.document_id) : null,
        flashcardCount: Number(job.flashcard_count ?? 0),
        quizCount: Number(job.quiz_count ?? 0),
        expectedItems: Number(job.expected_items ?? 0),
        completedItems: Number(counts?.completed ?? 0),
        totalItems: Number(counts?.total ?? 0),
        createdAt: job.created_at, startedAt: job.started_at,
        finishedAt: job.finished_at, completedAt: job.completed_at,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return ragResponseError(error);
  }
}
