// LANGKAH 0: inspeksi schema (jalankan: node scripts/inspect-schema.mjs)
import postgres from "postgres";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DATABASE_URL="(.+)"$/m)?.[1];
if (!url) throw new Error("SUPABASE_DATABASE_URL tidak ditemukan di .env.local");

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 20, ssl: "require" });

const tables = ["generation_jobs", "generation_job_items", "flashcards", "candidate_keywords", "documents", "deck_documents"];

for (const t of tables) {
  const exists = await sql`select to_regclass('public.' || ${t}) is not null as exists`;
  console.log(`\n=== ${t} (exists=${exists[0].exists}) ===`);
  if (!exists[0].exists) continue;
  const cols = await sql`
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema='public' and table_name=${t}
    order by ordinal_position`;
  for (const c of cols) console.log(`  ${c.column_name} | ${c.data_type} | null=${c.is_nullable} | default=${c.column_default ?? ""}`);
  const cons = await sql`
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = ('public.' || ${t})::regclass
    order by contype, conname`;
  for (const c of cons) console.log(`  CONSTRAINT ${c.conname}: ${c.def}`);
  const idx = await sql`
    select indexname, indexdef from pg_indexes
    where schemaname='public' and tablename=${t} order by indexname`;
  for (const i of idx) console.log(`  INDEX ${i.indexname}: ${i.indexdef}`);
}

await sql.end();
