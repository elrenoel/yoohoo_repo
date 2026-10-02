import * as dotenv from "dotenv";
import { classifyAndSelectCoreKeywords } from "../src/lib/rag/core-keywords";
import { UUID } from "../src/lib/rag/core";
import { closeRagSql, ragSql } from "../src/lib/rag/db";

dotenv.config({ path: ".env.local" });

function option(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const requestedDeckId = option("deck-id");
  if (requestedDeckId && !UUID.test(requestedDeckId)) throw new Error("--deck-id must be a UUID");
  const parsedLimit = Number(option("limit") ?? "100");
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 1_000) : 100;
  const sql = ragSql();
  const deckFilter = requestedDeckId ? sql`and d.id=${requestedDeckId}::uuid` : sql``;
  const decks = await sql`select d.id,d.user_id,d.title
    from public.decks d
    where true ${deckFilter}
      and exists (
        select 1 from public.deck_documents dd
        join public.candidate_keywords k on k.document_id=dd.document_id
        where dd.deck_id=d.id and (k.topic_label is null or k.content_type is null
          or k.importance_score is null or k.why_important is null)
      )
    order by d.created_at,d.id limit ${limit}`;
  console.log(`[core-keywords] ${decks.length} deck(s) need classification`);
  for (const deck of decks) {
    console.log(`[core-keywords] classifying ${deck.title} (${deck.id})`);
    const result = await classifyAndSelectCoreKeywords(String(deck.id), String(deck.user_id));
    console.log("[core-keywords] done", result);
  }
}

main().catch(error => {
  console.error("[core-keywords] backfill failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(closeRagSql);
