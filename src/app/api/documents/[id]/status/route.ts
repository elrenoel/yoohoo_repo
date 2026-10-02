import { ragSql } from "@/lib/rag/db";
import { RagError } from "@/lib/rag/core";
import { documentId, ragResponseError, sessionUser } from "@/lib/rag/http";

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, context: Context) {
  try {
    const userId = await sessionUser(request);
    const id = documentId((await context.params).id);
    const [document] = await ragSql()`select id,title,page_count,status,error_message as "errorMessage"
      from public.documents
      where id=${id}
        and user_id=${userId}
        and deleted_at is null
        and storage_path is not null`;

    if (!document) throw new RagError("Dokumen tidak ditemukan.", 404);

    return Response.json(
      {
        documentId: document.id,
        title: document.title,
        pageCount: document.page_count,
        status: document.status,
        errorMessage: document.errorMessage,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return ragResponseError(error);
  }
}
