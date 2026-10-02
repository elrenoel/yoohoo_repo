import { ragSql } from "@/lib/rag/db";
import { documentId, jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const id = documentId((await context.params).id);
    const sql = ragSql();
    const [owned] = await sql`select id from public.decks where id=${id} and user_id=${userId}`;
    if (!owned) return Response.json({ error: "Meja kerja tidak ditemukan." }, { status: 404 });
    const rows = await sql`select k.id,k.document_id,k.term,k.snippet,k.is_selected,k.chunk_id,
        k.content_type,k.is_core,k.importance_score,k.why_important,k.topic_label,k.core_overridden_by_user
      from public.candidate_keywords k join public.deck_documents dd on dd.document_id=k.document_id
      join public.documents d on d.id=dd.document_id
      where dd.deck_id=${id} and d.user_id=${userId} and d.deleted_at is null order by lower(k.term),k.id`;
    return Response.json({ classificationPending: rows.some(k => !k.topic_label || !k.content_type || k.importance_score === null || !k.why_important), keywords: rows.map(k => ({
      id: String(k.id), documentId: String(k.document_id), term: String(k.term),
      snippet: k.snippet as string | null, isSelected: Boolean(k.is_selected),
      chunkId: k.chunk_id ? String(k.chunk_id) : null,
      contentType: k.content_type as string | null, isCore: Boolean(k.is_core),
      importanceScore: k.importance_score === null ? null : Number(k.importance_score),
      whyImportant: k.why_important as string | null, topicLabel: k.topic_label as string | null,
      coreOverriddenByUser: Boolean(k.core_overridden_by_user),
    })) });
  } catch (error) { return ragResponseError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const id = documentId((await context.params).id);
    const body = await jsonBody(request);
    if (!Array.isArray(body.selectedIds) || body.selectedIds.some((value: unknown) => typeof value !== "string")) return Response.json({ error: "selectedIds harus berupa array." }, { status: 400 });
    const sql = ragSql();
    const [owned] = await sql`select id from public.decks where id=${id} and user_id=${userId}`;
    if (!owned) return Response.json({ error: "Meja kerja tidak ditemukan." }, { status: 404 });
    const selectedIds = body.selectedIds as string[];
    await sql.begin(async tx => {
      await tx`update public.candidate_keywords k set is_selected=false where k.id in (select ck.id from public.candidate_keywords ck join public.deck_documents dd on dd.document_id=ck.document_id where dd.deck_id=${id})`;
      if (selectedIds.length) await tx`update public.candidate_keywords set is_selected=true where id=any(${tx.array(selectedIds)}::uuid[]) and document_id in (select document_id from public.deck_documents where deck_id=${id})`;
      await tx`update public.decks set updated_at=now() where id=${id}`;
    });
    return Response.json({ success: true, selectedIds });
  } catch (error) { return ragResponseError(error); }
}
