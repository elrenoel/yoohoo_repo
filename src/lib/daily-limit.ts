import { db } from "@/db";

export const DAILY_LIMIT = 5;

export interface UserQuota {
  currentCount: number;
  remainingToday: number;
  today: string;
  isNewDay: boolean;
}

/**
 * Ambil status kuota harian user. Count otomatis di-reset ke 0
 * jika last_generation_date bukan hari ini.
 * Return null jika user tidak ditemukan di DB.
 */
export async function getUserQuota(userId: string): Promise<UserQuota | null> {
  const { data: row, error } = await db.from("user").select("generation_count_today,last_generation_date").eq("id", userId).maybeSingle();
  if (error) throw error;

  if (!row) return null;

  const today = new Date().toISOString().split("T")[0]; // format "2026-08-18"
  const isNewDay = row.last_generation_date !== today;
  // Older Better Auth users may have a NULL counter because the field was
  // added after their account was created. Treat that as zero so the daily
  // quota can be consumed and displayed correctly.
  const currentCount = isNewDay ? 0 : (row.generation_count_today ?? 0);

  return {
    currentCount,
    remainingToday: Math.max(0, DAILY_LIMIT - currentCount),
    today,
    isNewDay,
  };
}

/**
 * Increment generation_count_today dan set last_generation_date.
 * Menerima baseCount (count sebelum increment) agar tetap satu sumber kebenaran.
 */
export async function incrementGenerationUsage(
  userId: string,
  today: string,
  baseCount: number
): Promise<number> {
  const newCount = baseCount + 1;
  const { error } = await db.from("user").update({ generation_count_today: newCount, last_generation_date: today, updated_at: new Date().toISOString() }).eq("id", userId);
  if (error) throw error;
  return newCount;
}
