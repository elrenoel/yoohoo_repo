import { ragSql } from "@/lib/rag/db";
import { documentId, ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const id = documentId((await context.params).id);
    const sql = ragSql();
    const [owned] = await sql`select id from public.decks where id=${id} and user_id=${userId}`;
    if (!owned) return Response.json({ error: "Meja kerja tidak ditemukan." }, { status: 404 });
    const rows = await sql`select j.id,j.document_id,j.status,j.error_message,j.flashcard_count,j.quiz_count,
        j.created_at,j.completed_at,d.title as document_title
      from public.generation_jobs j
      join public.deck_documents dd on dd.document_id=j.document_id and dd.deck_id=${id}
      join public.documents d on d.id=j.document_id
      where j.user_id=${userId} and d.deleted_at is null
      order by j.created_at desc`;
    return Response.json({ generations: rows.map(row => ({
      id: String(row.id), documentId: String(row.document_id), documentTitle: String(row.document_title),
      status: String(row.status), errorMessage: row.error_message as string | null,
      flashcardCount: Number(row.flashcard_count ?? 0), quizCount: Number(row.quiz_count ?? 0),
      createdAt: row.created_at, completedAt: row.completed_at,
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return ragResponseError(error); }
}
