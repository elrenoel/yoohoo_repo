import "dotenv/config";
import { embedAndRelateKeywords } from "../src/lib/rag/pipeline";
import { ragSql, closeRagSql } from "../src/lib/rag/db";

/**
 * Backfill vectors for existing candidate keywords and rebuild semantic links.
 * Run after applying the semantic-relations migration:
 *   npx tsx scripts/backfill-keyword-embeddings.ts
 */
async function main() {
  const sql = ragSql();
  const documents = await sql`select distinct document_id from public.candidate_keywords order by document_id`;
  for (const row of documents) {
    const documentId = String(row.document_id);
    console.log(`[embedding] processing ${documentId}`);
    const result = await embedAndRelateKeywords(documentId);
    console.log(`[embedding] ${documentId}: ${result.embedded} vectors, ${result.relations} semantic links`);
  }
}

main().catch(error => {
  console.error("Embedding backfill failed", error);
  process.exitCode = 1;
}).finally(() => closeRagSql());
