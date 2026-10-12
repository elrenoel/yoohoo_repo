import { purgeExpiredTrashedDecks, TRASH_RETENTION_DAYS } from "../route";
import { ragSql } from "@/lib/rag/db";
import { ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await sessionUser(request);
    const sql = ragSql();
    // Loading Trash doubles as the 30-day purge sweep for this user.
    await purgeExpiredTrashedDecks(sql, userId);
    const rows = await sql`select d.id,d.title,d.deleted_at,
      count(distinct dd.document_id)::int as material_count,
      ceil(extract(epoch from (d.deleted_at + (${TRASH_RETENTION_DAYS} || ' days')::interval - now())) / 86400)::int as purge_in_days
      from public.decks d left join public.deck_documents dd on dd.deck_id=d.id
      where d.user_id=${userId} and d.deleted_at is not null
      group by d.id order by d.deleted_at desc`;
    return Response.json({
      retentionDays: TRASH_RETENTION_DAYS,
      decks: rows.map(row => ({
        id: String(row.id),
        title: String(row.title),
        materialCount: Number(row.material_count ?? 0),
        deletedAt: row.deleted_at,
        purgeInDays: Number(row.purge_in_days ?? 0),
      })),
    });
  } catch (error) { return ragResponseError(error); }
}

export async function DELETE(request: Request) {
  try {
    const userId = await sessionUser(request);
    const rows = await ragSql().begin(async sql => {
      const deleted = await sql<{ id: string; title: string }[]>`delete from public.decks
        where user_id=${userId} and deleted_at is not null
        returning id,title`;
      if (deleted.length) {
        await sql`insert into public.notifications
          (user_id,type,severity,title,body,link,dedupe_key)
          values (${userId},'trash_emptied','info','Trash emptied',
            ${`${deleted.length} ${deleted.length === 1 ? "deck was" : "decks were"} permanently deleted.`},
            '/trash',${`trash:${userId}:emptied:${Date.now()}`})`;
      }
      return deleted;
    });
    return Response.json({ success: true, deletedCount: rows.length });
  } catch (error) { return ragResponseError(error); }
}
