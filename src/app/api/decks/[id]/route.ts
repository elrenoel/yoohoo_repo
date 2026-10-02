import { ragSql } from "@/lib/rag/db";
import { documentId, ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const id = documentId((await context.params).id);
    const sql = ragSql();
    const [deck] = await sql`select id,title,created_at,updated_at,is_starred,starred_at from public.decks where id=${id} and user_id=${userId}`;
    if (!deck) return Response.json({ error: "Meja kerja tidak ditemukan." }, { status: 404 });
    const documents = await sql`select d.id,d.title,d.status,d.page_count,d.created_at,dd.added_at,
      (select count(*)::int from public.flashcards f where f.document_id=d.id) as flashcard_count,
      coalesce((select jsonb_agg(to_jsonb(preview)) from (
        select f.id,f.term,f.definition from public.flashcards f where f.document_id=d.id order by f.id limit 3
      ) preview), '[]'::jsonb) as flashcard_preview
      from public.deck_documents dd join public.documents d on d.id=dd.document_id
      where dd.deck_id=${id} and d.user_id=${userId} and d.deleted_at is null order by dd.added_at desc`;
    return Response.json({ deck: { id: String(deck.id), title: String(deck.title), createdAt: deck.created_at, updatedAt: deck.updated_at, isStarred: Boolean(deck.is_starred), starredAt: deck.starred_at }, documents: documents.map(d => ({
      id: String(d.id), title: String(d.title), status: String(d.status), pageCount: d.page_count,
      createdAt: d.created_at, addedAt: d.added_at, flashcardCount: Number(d.flashcard_count ?? 0),
      flashcardPreview: Array.isArray(d.flashcard_preview) ? d.flashcard_preview.map(card => ({ id: String(card.id), term: String(card.term), definition: String(card.definition) })) : [],
    })) });
  } catch (error) { return ragResponseError(error); }
}
