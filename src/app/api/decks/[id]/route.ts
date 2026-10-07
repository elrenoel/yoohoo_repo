import { ragSql } from "@/lib/rag/db";
import { documentId, jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const id = documentId((await context.params).id);
    const sql = ragSql();
    const [deck] = await sql`select id,title,created_at,updated_at,is_starred,starred_at,is_priority from public.decks where id=${id} and user_id=${userId}`;
    if (!deck) return Response.json({ error: "Meja kerja tidak ditemukan." }, { status: 404 });
    const documents = await sql`select d.id,d.title,d.status,d.page_count,d.created_at,dd.added_at,
      (select count(*)::int from public.flashcards f where f.document_id=d.id) as flashcard_count,
      coalesce((select jsonb_agg(to_jsonb(preview)) from (
        select f.id,f.term,f.definition from public.flashcards f where f.document_id=d.id order by f.id limit 3
      ) preview), '[]'::jsonb) as flashcard_preview
      from public.deck_documents dd join public.documents d on d.id=dd.document_id
      where dd.deck_id=${id} and d.user_id=${userId} and d.deleted_at is null order by dd.added_at desc`;
    return Response.json({ deck: { id: String(deck.id), title: String(deck.title), createdAt: deck.created_at, updatedAt: deck.updated_at, isStarred: Boolean(deck.is_starred), starredAt: deck.starred_at, isPriority: Boolean(deck.is_priority) }, documents: documents.map(d => ({
      id: String(d.id), title: String(d.title), status: String(d.status), pageCount: d.page_count,
      createdAt: d.created_at, addedAt: d.added_at, flashcardCount: Number(d.flashcard_count ?? 0),
      flashcardPreview: Array.isArray(d.flashcard_preview) ? d.flashcard_preview.map(card => ({ id: String(card.id), term: String(card.term), definition: String(card.definition) })) : [],
    })) });
  } catch (error) { return ragResponseError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const id = documentId((await context.params).id);
    const body = await jsonBody(request);
    const hasTitle = typeof body.title === "string";
    const hasPriority = typeof body.is_priority === "boolean";
    if (!hasTitle && !hasPriority) return Response.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
    if (hasTitle && !(body.title as string).trim()) return Response.json({ error: "Judul deck wajib diisi." }, { status: 400 });
    const title = hasTitle ? (body.title as string).trim().slice(0, 200) : null;
    const isPriority = hasPriority ? (body.is_priority as boolean) : null;
    const [row] = await ragSql()`update public.decks set
      title=coalesce(${title}::text,title),
      is_priority=coalesce(${isPriority}::boolean,is_priority),
      updated_at=now()
      where id=${id} and user_id=${userId}
      returning id,title,is_priority,updated_at`;
    if (!row) return Response.json({ error: "Meja kerja tidak ditemukan." }, { status: 404 });
    return Response.json({ deck: { id: String(row.id), title: String(row.title), isPriority: Boolean(row.is_priority), updatedAt: row.updated_at } });
  } catch (error) { return ragResponseError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const id = documentId((await context.params).id);
    // Soft delete: the deck lands in Trash (deleted_at set). Source documents
    // and deck_documents relations stay untouched so restore is lossless.
    const [row] = await ragSql().begin(async sql => {
      const [deleted] = await sql`update public.decks set deleted_at=now()
        where id=${id} and user_id=${userId} and deleted_at is null
        returning id,title`;
      if (!deleted) return [];
      await sql`insert into public.notifications (user_id,type,severity,title,body,link,dedupe_key)
        values (${userId},'deck_deleted','info','Deck dipindahkan ke Sampah',${`Deck "${String(deleted.title)}" dapat dipulihkan selama 30 hari.`},'/trash',${`deck:${id}:trashed`})
        on conflict (dedupe_key) do update set read_at=null,created_at=now(),body=excluded.body`;
      return [deleted];
    });
    if (!row) return Response.json({ error: "Meja kerja tidak ditemukan." }, { status: 404 });
    return Response.json({ success: true, deletedDeckId: String(row.id) });
  } catch (error) { return ragResponseError(error); }
}
