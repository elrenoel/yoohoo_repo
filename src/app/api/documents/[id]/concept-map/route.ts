import { ragSql } from "@/lib/rag/db";
import { documentId, ragResponseError, sessionUser } from "@/lib/rag/http";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";

export async function GET(request: Request, context: Context) {
  try {
    const userId = await sessionUser(request);
    const id = documentId((await context.params).id);
    const sql = ragSql();
    const [document] = await sql`select id from public.documents
      where id=${id} and user_id=${userId} and deleted_at is null`;
    if (!document) return Response.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });

    const nodes = await sql`select id,term,snippet
      from public.candidate_keywords where document_id=${id} order by lower(term),id`;
    const edges = await sql`select from_keyword_id as "from",to_keyword_id as "to",relation_type as type
      from public.keyword_relations where document_id=${id}`;
    return Response.json({
      nodes: nodes.map(node => ({ id: String(node.id), term: String(node.term), snippet: node.snippet as string | null })),
      edges: edges.map(edge => ({ from: String(edge.from), to: String(edge.to), type: String(edge.type) })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return ragResponseError(error);
  }
}
