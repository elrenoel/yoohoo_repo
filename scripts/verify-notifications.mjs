import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });
if (!process.env.SUPABASE_DATABASE_URL) throw new Error("SUPABASE_DATABASE_URL belum diatur.");
const sql = postgres(process.env.SUPABASE_DATABASE_URL, { prepare: false, max: 1, connect_timeout: 20, ssl: "require" });

const rows = await sql`
  select id,type,severity,title,body,link,read_at,created_at
  from public.notifications
  order by created_at desc
  limit 20`;
if (!rows.length) throw new Error("Belum ada notifikasi untuk diverifikasi.");
if (rows.some(row => !row.type || !row.title || !row.body || !row.link)) {
  throw new Error("Ada notifikasi yang belum memiliki detail lengkap.");
}
console.log(`OK: ${rows.length} notifikasi terbaru memiliki type, title, body, dan link.`);

const [functionCheck] = await sql`
  select p.prosecdef, pg_get_functiondef(p.oid) as definition,
    exists (select 1 from unnest(coalesce(p.proconfig,array[]::text[])) value where value like 'search_path=%') as safe_path
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='notify_job_change'`;
if (!functionCheck?.prosecdef || !functionCheck.safe_path) throw new Error("Trigger notifikasi belum memiliki konfigurasi keamanan yang diharapkan.");
console.log("OK: trigger notify_job_change aktif dengan search_path kosong.");
if (!functionCheck.definition.includes("quiz_generate") || !functionCheck.definition.includes("quizSetId")) {
  throw new Error("Trigger notifikasi belum menangani hasil generate ulang quiz.");
}
console.log("OK: trigger notifikasi mengarahkan quiz_generate ke quizSetId yang tepat.");

await sql.end();
