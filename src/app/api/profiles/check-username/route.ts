import { checkRateLimit } from "@/lib/rate-limit";
import { ragSql } from "@/lib/rag/db";
import { RESERVED_USERNAMES, usernameSchema } from "@/lib/profile-validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = forwarded || request.headers.get("x-real-ip") || "local";
  const rate = checkRateLimit(`username:${clientKey}`);
  if (!rate.allowed) {
    return Response.json({ available: false, error: "Terlalu banyak permintaan. Coba lagi sebentar." }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))) },
    });
  }
  const raw = new URL(request.url).searchParams.get("u") ?? "";
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success || RESERVED_USERNAMES.has(raw.trim().toLowerCase())) {
    return Response.json({ available: false });
  }
  const sql = ragSql();
  const rows = await sql<{ exists: boolean }[]>`
    select exists(select 1 from public.profiles where lower(username) = lower(${parsed.data})) as exists
  `;
  return Response.json({ available: !rows[0]?.exists });
}
