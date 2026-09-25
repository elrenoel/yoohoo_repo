import { ragSql } from "@/lib/rag/db";
import { RagError } from "@/lib/rag/core";
import { documentId, jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";
import { dispatchDocument, pdfKey, verifyPdf } from "@/lib/rag/storage";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const userId = await sessionUser(request), body = await jsonBody(request), id = documentId(body.documentId);
    if (typeof body.filename !== "string" || !body.filename.toLowerCase().endsWith(".pdf") || body.filename.length > 255) throw new RagError("Nama PDF tidak valid.");
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : body.filename;
    if (title.length > 200) throw new RagError("Judul maksimal 200 karakter.");
    const contentLanguage = typeof body.contentLanguage === "string" && ["auto", "id", "en"].includes(body.contentLanguage)
      ? body.contentLanguage
      : "auto";
    const key = pdfKey(userId, id), size = await verifyPdf(key), sql = ragSql();
    await sql`insert into public.documents (id,user_id,title,raw_text,content_language,storage_path,file_size,status)
      values (${id},${userId},${title},'',${contentLanguage},${key},${size},'uploaded') on conflict (id) do nothing`;
    const [doc] = await sql`select id,status from public.documents where id=${id} and user_id=${userId} and storage_path=${key} and deleted_at is null`;
    if (!doc) throw new RagError("Dokumen tidak ditemukan.", 404);
    // Retrying confirm republishes the marker if dispatch failed after the DB commit.
    if (doc.status === "uploaded" || doc.status === "chunking" || doc.status === "indexing") await dispatchDocument(id, userId);
    return Response.json({ documentId: id, status: doc.status }, { status: 202 });
  } catch (error) { return ragResponseError(error); }
}
