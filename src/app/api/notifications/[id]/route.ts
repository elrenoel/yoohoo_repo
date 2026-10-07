import { ragSql } from "@/lib/rag/db";
import { RagError, UUID } from "@/lib/rag/core";
import { ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const id = (await context.params).id;
    if (!UUID.test(id)) throw new RagError("ID notifikasi tidak valid.");
    const [row] = await ragSql()`select n.id,n.type,n.severity,n.title,n.body,n.link,n.read_at,n.created_at,
      j.id as job_id,j.kind as job_kind,j.status as job_status,j.error_message,
      j.flashcard_count,j.quiz_count,j.expected_items,j.started_at,j.finished_at,
      j.input as job_input,j.result as job_result,
      coalesce(d.id,j.deck_id) as deck_id,d.title as deck_title,
      doc.id as document_id,doc.title as document_title
      from public.notifications n
      left join public.generation_jobs j on j.id=n.job_id and j.user_id=n.user_id
      left join public.decks d on d.id=j.deck_id and d.user_id=n.user_id
      left join public.documents doc on doc.id=j.document_id and doc.user_id=n.user_id
      where n.id=${id} and n.user_id=${userId}`;
    if (!row) throw new RagError("Notifikasi tidak ditemukan.", 404);
    return Response.json({ notification: {
      id: String(row.id), type: row.type, severity: row.severity, title: row.title,
      body: row.body, link: row.link, readAt: row.read_at, createdAt: row.created_at,
      job: row.job_id ? {
        id: String(row.job_id), kind: row.job_kind, status: row.job_status,
        errorMessage: row.error_message, flashcardCount: Number(row.flashcard_count ?? 0),
        quizCount: Number(row.quiz_count ?? 0), expectedItems: Number(row.expected_items ?? 0),
        startedAt: row.started_at, finishedAt: row.finished_at,
        variant: row.job_input?.variant ? String(row.job_input.variant) : null,
        quizSetId: row.job_result?.quizSetId ? String(row.job_result.quizSetId) : null,
        quizSetLabel: row.job_result?.quizSetLabel ? String(row.job_result.quizSetLabel) : null,
      } : null,
      deck: row.deck_id ? { id: String(row.deck_id), title: row.deck_title ? String(row.deck_title) : null } : null,
      document: row.document_id ? { id: String(row.document_id), title: row.document_title ? String(row.document_title) : null } : null,
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return ragResponseError(error);
  }
}
