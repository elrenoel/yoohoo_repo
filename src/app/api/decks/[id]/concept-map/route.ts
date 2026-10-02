import { ragSql } from "@/lib/rag/db";
import { documentId, ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const id = documentId((await context.params).id);
    const sql = ragSql();
    const [owned] = await sql`select id from public.decks where id=${id} and user_id=${userId}`;
    if (!owned) return Response.json({ error: "Meja kerja tidak ditemukan." }, { status: 404 });
    const nodes = await sql`select k.id,k.document_id,k.term,k.snippet from public.candidate_keywords k join public.deck_documents dd on dd.document_id=k.document_id join public.documents d on d.id=k.document_id where dd.deck_id=${id} and d.user_id=${userId} and d.deleted_at is null order by lower(k.term),k.id`;
    const [{ hasDeckScope }] = await sql<{ hasDeckScope: boolean }[]>`select exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='keyword_relations' and column_name='deck_id'
    ) as "hasDeckScope"`;
    const edges = hasDeckScope
      ? await sql`select distinct r.from_keyword_id as "from",r.to_keyword_id as "to",r.relation_type as type
          from public.keyword_relations r
          left join public.deck_documents dd on dd.document_id=r.document_id and dd.deck_id=${id}
          where (r.deck_id=${id} or (r.deck_id is null and dd.deck_id=${id}))
          order by r.from_keyword_id,r.to_keyword_id`
      : await sql`select distinct r.from_keyword_id as "from",r.to_keyword_id as "to",r.relation_type as type
          from public.keyword_relations r
          join public.deck_documents dd on dd.document_id=r.document_id and dd.deck_id=${id}
          join public.documents d on d.id=r.document_id
          where d.user_id=${userId} and d.deleted_at is null
          order by r.from_keyword_id,r.to_keyword_id`;
    return Response.json({ nodes: nodes.map(n => ({ id: String(n.id), documentId: String(n.document_id), term: String(n.term), snippet: n.snippet as string | null })), edges: edges.map(e => ({ from: String(e.from), to: String(e.to), type: String(e.type) })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return ragResponseError(error); }
}
