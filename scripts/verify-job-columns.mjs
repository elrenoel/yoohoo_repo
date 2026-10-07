// Verifikasi kolom yang dipakai route generate/run/jobs benar-benar ada.
// Jalankan: node scripts/verify-job-columns.mjs
import postgres from "postgres";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DATABASE_URL="(.+)"$/m)?.[1];
if (!url) throw new Error("SUPABASE_DATABASE_URL tidak ditemukan di .env.local");
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 20, ssl: "require" });

const expected = {
  generation_jobs: ["id", "user_id", "kind", "status", "deck_id", "document_id", "idempotency_key",
    "input", "result", "error_message", "attempts", "expected_items", "flashcard_count", "quiz_count",
    "quota_count", "remaining_quota", "selected_keyword_ids", "created_at", "started_at", "finished_at", "completed_at"],
  generation_job_items: ["id", "job_id", "document_id", "keyword_id", "chunk_id", "batch_index",
    "keyword_ids", "status", "flashcards", "error_message", "created_at", "updated_at"],
  flashcards: ["id", "document_id", "deck_id", "keyword_id", "job_id", "term", "definition"],
  notifications: ["id", "user_id", "job_id", "type", "severity", "title", "body", "link", "dedupe_key", "read_at", "created_at"],
  candidate_keywords: ["id", "document_id", "term", "snippet", "chunk_id"],
  deck_documents: ["deck_id", "document_id"],
};

let failed = 0;
for (const [table, cols] of Object.entries(expected)) {
  const rows = await sql`select column_name from information_schema.columns
    where table_schema='public' and table_name=${table}`;
  const have = new Set(rows.map(r => r.column_name));
  const missing = cols.filter(c => !have.has(c));
  console.log(`${missing.length ? "FAIL" : "OK  "} | ${table}${missing.length ? " | missing: " + missing.join(", ") : ` (${have.size} kolom)`}`);
  if (missing.length) failed += 1;
}

const idx = await sql`select indexname from pg_indexes where schemaname='public'`;
const names = new Set(idx.map(r => r.indexname));
for (const name of [
  "flashcards_deck_keyword_unique",              // UNIQUE (deck_id, keyword_id)
  "generation_jobs_user_idempotency_key_key",    // UNIQUE (user_id, idempotency_key)
  "generation_job_items_job_keyword_unique",      // UNIQUE (job_id, keyword_id)
  "generation_job_items_document_id_idx",
  "notifications_user_unread_idx",                // partial: unread
]) {
  const ok = names.has(name);
  console.log(`${ok ? "OK  " : "FAIL"} | index ${name}`);
  if (!ok) failed += 1;
}

const [statusCheck] = await sql`
  select pg_get_constraintdef(oid) as def from pg_constraint
  where conname='generation_jobs_status_check' and conrelid='public.generation_jobs'::regclass`;
console.log(`INFO | generation_jobs_status_check: ${statusCheck?.def ?? "TIDAK ADA"}`);

const [rls] = await sql`select relrowsecurity from pg_class
  where oid='public.generation_jobs'::regclass`;
console.log(`INFO | RLS generation_jobs: ${rls.relrowsecurity}`);

await sql.end();
console.log(failed ? `\n${failed} CHECK GAGAL` : "\nSEMUA CHECK LOLOS");
process.exit(failed ? 1 : 0);
