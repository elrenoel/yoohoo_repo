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
    const groups = await sql`select g.id,g.name,g.created_at,count(f.id)::int card_count,
      coalesce(jsonb_agg(distinct jsonb_build_object('id',d.id,'title',d.title)) filter(where d.id is not null),'[]'::jsonb) materials,
      coalesce((select jsonb_agg(to_jsonb(p)) from (select fc.id,fc.term,fc.definition from public.flashcards fc where fc.group_id=g.id order by fc.id limit 3)p),'[]'::jsonb) preview,
      coalesce((select round(100.0*a.score/nullif(a.total,0))::int from public.quiz_sets qs join public.quiz_attempts a on a.quiz_set_id=qs.id where qs.group_id=g.id and a.user_id=${userId} order by a.created_at desc limit 1),0)::int mastery,
      (select qs.id from public.quiz_sets qs where qs.group_id=g.id order by qs.created_at desc limit 1) quiz_set_id
      from public.flashcard_groups g left join public.flashcards f on f.group_id=g.id left join public.documents d on d.id=f.source_document_id
      where g.deck_id=${id} and g.user_id=${userId} group by g.id order by g.created_at desc`;
    return Response.json({ deck: { id: String(deck.id), title: String(deck.title), createdAt: deck.created_at, updatedAt: deck.updated_at, isStarred: Boolean(deck.is_starred), starredAt: deck.starred_at, isPriority: Boolean(deck.is_priority) }, documents: documents.map(d => ({
      id: String(d.id), title: String(d.title), status: String(d.status), pageCount: d.page_count,
      createdAt: d.created_at, addedAt: d.added_at, flashcardCount: Number(d.flashcard_count ?? 0),
      flashcardPreview: Array.isArray(d.flashcard_preview) ? d.flashcard_preview.map(card => ({ id: String(card.id), term: String(card.term), definition: String(card.definition) })) : [],
    })), flashcardGroups: groups.map(g=>({id:String(g.id),name:String(g.name),createdAt:g.created_at,cardCount:Number(g.card_count??0),materials:Array.isArray(g.materials)?g.materials:[],preview:Array.isArray(g.preview)?g.preview:[],mastery:Number(g.mastery??0),quizSetId:g.quiz_set_id?String(g.quiz_set_id):null})) });
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
        values (${userId},'deck_deleted','info','Deck moved to Trash',${`Deck "${String(deleted.title)}" can be restored within 30 days.`},'/trash',${`deck:${id}:trashed`})
        on conflict (dedupe_key) do update set read_at=null,created_at=now(),body=excluded.body`;
      return [deleted];
    });
    if (!row) return Response.json({ error: "Meja kerja tidak ditemukan." }, { status: 404 });
    return Response.json({ success: true, deletedDeckId: String(row.id) });
  } catch (error) { return ragResponseError(error); }
}
