import "server-only";
import { ragSql } from "@/lib/rag/db";

export type UserRateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export async function checkUserRateLimit(userId: string, action: string, limit: number, windowSeconds = 60): Promise<UserRateLimitResult> {
  const sql = ragSql();
  const [row] = await sql<{ request_count: number; window_start: Date | string }[]>`
    insert into public.api_rate_limits(user_id,action,window_start,request_count)
    values(${userId},${action},to_timestamp(floor(extract(epoch from now())/${windowSeconds})*${windowSeconds}),1)
    on conflict(user_id,action,window_start) do update
      set request_count=public.api_rate_limits.request_count+1
    returning request_count,window_start`;
  const count = Number(row.request_count);
  const resetAt = new Date(row.window_start).getTime() + windowSeconds * 1000;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) };
}

export function rateLimitResponse(result: UserRateLimitResult) {
  return Response.json({ error: "RATE_LIMITED", retryAfter: result.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } });
}
