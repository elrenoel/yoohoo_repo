import { ragSql } from "@/lib/rag/db";
import { RagError, UUID } from "@/lib/rag/core";
import { documentId, jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export async function GET(request: Request, context: Context) {
  try {
    const userId = await sessionUser(request), id = documentId((await context.params).id), sql = ragSql();
    const [doc] = await sql`select id,title,status,page_count as "pageCount",error_message as "errorMessage"
      from public.documents where id=${id} and user_id=${userId} and deleted_at is null and storage_path is not null`;
    if (!doc) throw new RagError("Dokumen tidak ditemukan.", 404);
    const [progress] = await sql`select count(*)::int as total, count(c.processed_at)::int as completed,
      count(*) filter (where c.processing_error is not null)::int as skipped
      from public.document_chunks c join public.documents d on d.id=c.document_id
      where d.id=${id} and d.user_id=${userId} and d.deleted_at is null`;
    const keywords = doc.status === "ready_for_selection" ? await sql`select k.id,k.term,k.snippet,k.is_selected as "isSelected"
      from public.candidate_keywords k join public.documents d on d.id=k.document_id
      where d.id=${id} and d.user_id=${userId} and d.deleted_at is null order by lower(k.term),k.id` : [];
    return Response.json({ document: doc, progress, keywords }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return ragResponseError(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const userId = await sessionUser(request), id = documentId((await context.params).id), body = await jsonBody(request);
    if (!Array.isArray(body.selectedIds) || body.selectedIds.length > 10000 || !body.selectedIds.every(x => typeof x === "string" && UUID.test(x))) throw new RagError("Pilihan keyword tidak valid.");
    const ids = [...new Set(body.selectedIds as string[])];
    await ragSql().begin(async sql => {
      const [doc] = await sql`select id,status from public.documents where id=${id} and user_id=${userId} and deleted_at is null for update`;
      if (!doc) throw new RagError("Dokumen tidak ditemukan.", 404);
      if (doc.status !== "ready_for_selection") throw new RagError("Dokumen belum siap.", 409);
      if (ids.length) {
        const owned = await sql`select id from public.candidate_keywords where document_id=${id} and id=any(${sql.array(ids)}::uuid[])`;
        if (owned.length !== ids.length) throw new RagError("Keyword bukan milik dokumen ini.");
        await sql`update public.candidate_keywords set is_selected=(id=any(${sql.array(ids)}::uuid[])) where document_id=${id}`;
      } else {
        await sql`update public.candidate_keywords set is_selected=false where document_id=${id}`;
      }
    });
    return Response.json({ success: true, selectedCount: ids.length });
  } catch (error) { return ragResponseError(error); }
}
