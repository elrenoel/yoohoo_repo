import { ragSql } from "@/lib/rag/db";
import { documentId, jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request); const id = documentId((await context.params).id); const body = await jsonBody(request);
    if (typeof body.is_starred !== "boolean") return Response.json({ error: "is_starred harus boolean." }, { status: 400 });
    const sql = ragSql();
    const [row] = await sql`update public.decks set is_starred=${body.is_starred},starred_at=case when ${body.is_starred} then now() else null end,updated_at=now() where id=${id} and user_id=${userId} returning is_starred,starred_at`;
    if (!row) return Response.json({ error: "Meja kerja tidak ditemukan." }, { status: 404 });
    return Response.json({ isStarred: Boolean(row.is_starred), starredAt: row.starred_at });
  } catch (error) { return ragResponseError(error); }
}
