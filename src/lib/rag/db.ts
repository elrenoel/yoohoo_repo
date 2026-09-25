import postgres from "postgres";

let connection: ReturnType<typeof postgres> | undefined;
// Imported only by server routes and Lambda handlers. Never export through a client module.
export function ragSql() {
  if (typeof window !== "undefined") throw new Error("Database is server-only");
  const url = process.env.SUPABASE_DATABASE_URL;
  if (!url) throw new Error("SUPABASE_DATABASE_URL is required");
  const ca = process.env.SUPABASE_DATABASE_CA?.replace(/\\n/g, "\n");
  // Match the existing Better Auth pool's encrypted connection during transition.
  // Supplying the project's CA enables certificate + hostname verification.
  return connection ??= postgres(url, { prepare: false, max: 2, idle_timeout: 20,
    connect_timeout: 30, ssl: ca ? { ca, rejectUnauthorized: true } : "require" });
}
export async function closeRagSql() { await connection?.end({ timeout: 5 }); connection = undefined; }
