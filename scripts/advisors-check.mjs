// Advisors equivalent (Supabase get_advisors: security + performance) — jalankan:
// node scripts/advisors-check.mjs
import postgres from "postgres";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DATABASE_URL="(.+)"$/m)?.[1];
if (!url) throw new Error("SUPABASE_DATABASE_URL tidak ditemukan di .env.local");
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 20, ssl: "require" });

const TARGET = ["generation_jobs", "generation_job_items", "flashcards", "candidate_keywords", "documents", "deck_documents", "notifications"];

console.log("== SECURITY ADVISOR ==");
// 1. Tabel public tanpa RLS (supabase_security_advisors: rls_disabled_in_public)
const noRls = await sql`
  select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relrowsecurity = false
  order by 1`;
console.log("RLS disabled di public (termasuk tabel warisan):", noRls.map(r => r.relname).join(", ") || "(tidak ada)");

// 2. SECURITY DEFINER function tanpa search_path eksplisit (supabase_security_advisors)
const definerNoPath = await sql`
  select p.proname,
    exists (
      select 1 from unnest(coalesce(p.proconfig, array[]::text[])) o
      where o like 'search_path=%'
    ) as has_search_path
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname not in ('pg_catalog','information_schema')
    and p.prosecdef = true`;
console.log("SECURITY DEFINER tanpa SET search_path:", definerNoPath.filter(r => !r.has_search_path).map(r => r.proname).join(", ") || "(tidak ada)");

// 3. RLS enabled tapi tanpa policy (informational — by design untuk koneksi postgres langsung)
const rlsNoPolicy = await sql`
  select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = true
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
  order by 1`;
console.log("RLS enabled tanpa policy (by design, akses via koneksi postgres):", rlsNoPolicy.map(r => r.relname).join(", ") || "(tidak ada)");

console.log("\n== PERFORMANCE ADVISOR ==");
// 4. FK tanpa index pendukung (supabase_performance_advisors: unindexed_foreign_key)
const unindexedFk = await sql`
  with fk as (
    select
      c.conrelid::regclass::text as table_name,
      c.conname,
      a.attname as column_name,
      c.conkey[1] as col_num
    from pg_constraint c
    join pg_class tbl on tbl.oid = c.conrelid
    join pg_namespace n on n.oid = tbl.relnamespace
    cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f' and n.nspname = 'public'
  )
  select f.table_name, f.column_name
  from fk f
  where not exists (
    select 1 from pg_index i
    where i.indrelid = f.table_name::regclass
      and i.indkey[0] = f.col_num
  )
  order by 1, 2`;
console.log("FK kolom tanpa index:");
for (const r of unindexedFk) console.log(`  ${r.table_name}.${r.column_name}`);

console.log("\n== TARGET TABLES (task scope) ==");
console.log("Ditemukan unindexed FK di tabel target:",
  unindexedFk.filter(r => TARGET.includes(r.table_name)).map(r => `${r.table_name}.${r.column_name}`).join(", ") || "(tidak ada)");

await sql.end();
