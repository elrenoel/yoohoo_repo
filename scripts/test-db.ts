import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from "../src/db";

async function main() {
  const checks = await Promise.all([
    db.from("user").select("id", { head: true, count: "exact" }),
    db.from("documents").select("id", { head: true, count: "exact" }),
    db.from("flashcards").select("id", { head: true, count: "exact" }),
    db.from("quiz_sets").select("id", { head: true, count: "exact" }),
    db.from("quiz_questions").select("id", { head: true, count: "exact" }),
    db.from("quiz_attempts").select("id", { head: true, count: "exact" }),
  ]);
  const error = checks.find((x) => x.error)?.error;
  if (error) throw error;
  console.log("Supabase connection and required tables: OK");
}
main().catch((error) => { console.error(error); process.exit(1); });
