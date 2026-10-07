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
