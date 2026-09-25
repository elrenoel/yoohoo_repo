import type { PostgrestError } from "@supabase/supabase-js";
export function assertDb<T>(data: T | null, error: PostgrestError | null): T {
  if (error) throw error;
  if (data === null) throw new Error("Database tidak mengembalikan data.");
  return data;
}
export function isQuotaError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "message" in error && String((error as { message: unknown }).message).includes("DAILY_LIMIT_REACHED");
}
