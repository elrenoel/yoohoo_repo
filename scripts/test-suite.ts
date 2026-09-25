import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  // CLI tests run outside Next.js, so do not import its server-only module guard.
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase test environment is missing");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const health = await db.from("documents").select("id", { head: true, count: "exact" });
  if (health.error) throw health.error;
  console.log("Supabase smoke suite: OK");
  console.log("Run TESTING.md scenarios against a linked test project for destructive CRUD/RPC tests.");
}
main().catch((error) => { console.error(error); process.exit(1); });
