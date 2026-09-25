import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key";

export const db = createClient<Database>(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { "X-Client-Info": "yoohoo-server" } },
});
export type { Database, Json } from "./types";
