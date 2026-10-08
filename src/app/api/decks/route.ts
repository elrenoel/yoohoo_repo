import { ragSql } from "@/lib/rag/db";
import { ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

export const TRASH_RETENTION_DAYS = 30;

/** Permanently remove decks that have spent more than 30 days in the trash. */
export async function purgeExpiredTrashedDecks(sql: ReturnType<typeof ragSql>, userId: string) {
  await sql`delete from public.decks
    where user_id=${userId} and deleted_at is not null
    and deleted_at < now() - (${TRASH_RETENTION_DAYS} || ' days')::interval`;
}

export async function GET(request: Request) {
  try {
    const userId = await sessionUser(request);
    const sql = ragSql();
    // Loading Your Desk doubles as the 30-day trash purge sweep.
    await purgeExpiredTrashedDecks(sql, userId);
    const rows = await sql`select d.id,d.title,d.created_at,d.updated_at,d.is_starred,d.starred_at,d.is_priority,d.visibility,d.slug,d.shared_at,
      pd.id as public_deck_id,pd.slug as public_deck_slug,pd.status as public_deck_status,pd.version as public_deck_version,
      count(distinct dd.document_id)::int as material_count,
      count(distinct k.id)::int as element_count,
      count(distinct dd.document_id) filter (where doc.status not in ('ready_for_selection','ready','completed','failed'))::int as processing_count
      from public.decks d left join public.deck_documents dd on dd.deck_id=d.id
      left join public.documents doc on doc.id=dd.document_id and doc.deleted_at is null
      left join public.candidate_keywords k on k.document_id=doc.id
      left join public.public_decks pd on pd.source_deck_id=d.id
      where d.user_id=${userId} and d.deleted_at is null group by d.id,pd.id order by d.is_priority desc, d.created_at desc`;
    return Response.json({ decks: rows.map(row => ({ id: String(row.id), title: String(row.title), createdAt: row.created_at, updatedAt: row.updated_at, materialCount: Number(row.material_count ?? 0), elementCount: Number(row.element_count ?? 0), processingCount: Number(row.processing_count ?? 0), isStarred: Boolean(row.is_starred), starredAt: row.starred_at, isPriority: Boolean(row.is_priority), visibility: String(row.visibility), slug: row.slug ? String(row.slug) : null, sharedAt: row.shared_at, publicDeck: row.public_deck_id ? {id:String(row.public_deck_id),slug:String(row.public_deck_slug),status:String(row.public_deck_status),version:Number(row.public_deck_version)} : null })) });
  } catch (error) { return ragResponseError(error); }
}
