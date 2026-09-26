import { ragSql } from "@/lib/rag/db";
import { RagError } from "@/lib/rag/core";
import { documentId, jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";
import { deletePdf, dispatchDocument, pdfKey, verifyPdf } from "@/lib/rag/storage";
import { DAILY_LIMIT } from "@/lib/daily-limit";
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
    let doc: { id: string; status: string } | undefined;
    try {
      doc = await sql.begin(async tx => {
        const [event] = await tx`select id from public.generation_quota_events where user_id=${userId} and event_key=${`document:${id}`} for update`;
        if (!event) {
          const [quota] = await tx`select * from private.consume_generation_quota_event(${userId},${`document:${id}`},'document_pipeline',${DAILY_LIMIT},${id})`;
          void quota;
        }
        await tx`insert into public.documents (id,user_id,title,raw_text,content_language,storage_path,file_size,status)
          values (${id},${userId},${title},'',${contentLanguage},${key},${size},'uploaded') on conflict (id) do nothing`;
        const [row] = await tx`select id,status from public.documents where id=${id} and user_id=${userId} and storage_path=${key} and deleted_at is null`;
        return row;
      }) as { id: string; status: string } | undefined;
    } catch (error) {
      if (error instanceof Error && error.message.includes("DAILY_LIMIT_REACHED")) {
        await deletePdf(key);
        return Response.json({ limitReached: true, remainingToday: 0, dailyLimit: DAILY_LIMIT, error: "Limit harian sudah tercapai. Coba lagi besok." }, { status: 429 });
      }
      throw error;
    }
    if (!doc) throw new RagError("Dokumen tidak ditemukan.", 404);
    // Retrying confirm republishes the marker if dispatch failed after the DB commit.
    if (doc.status === "uploaded" || doc.status === "chunking" || doc.status === "indexing") await dispatchDocument(id, userId);
    return Response.json({ documentId: id, status: doc.status }, { status: 202 });
  } catch (error) { return ragResponseError(error); }
}
