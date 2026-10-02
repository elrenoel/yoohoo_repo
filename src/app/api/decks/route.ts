import { ragSql } from "@/lib/rag/db";
import { ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await sessionUser(request);
    const sql = ragSql();
    const rows = await sql`select d.id,d.title,d.created_at,d.updated_at,d.is_starred,d.starred_at,
      count(distinct dd.document_id)::int as material_count,
      count(distinct k.id)::int as element_count,
      count(distinct dd.document_id) filter (where doc.status not in ('ready_for_selection','ready','completed','failed'))::int as processing_count
      from public.decks d left join public.deck_documents dd on dd.deck_id=d.id
      left join public.documents doc on doc.id=dd.document_id and doc.deleted_at is null
      left join public.candidate_keywords k on k.document_id=doc.id
      where d.user_id=${userId} group by d.id order by d.updated_at desc`;
    return Response.json({ decks: rows.map(row => ({ id: String(row.id), title: String(row.title), createdAt: row.created_at, updatedAt: row.updated_at, materialCount: Number(row.material_count ?? 0), elementCount: Number(row.element_count ?? 0), processingCount: Number(row.processing_count ?? 0), isStarred: Boolean(row.is_starred), starredAt: row.starred_at })) });
  } catch (error) { return ragResponseError(error); }
}
