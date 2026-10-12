import { checkRateLimit } from "@/lib/rate-limit";
import { getExploreTags } from "@/lib/explore-server";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`explore-tags:${ip}`, 30, 60_000).allowed) return Response.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  try {
    const rows = await getExploreTags();
    return Response.json({ tags: rows }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("[explore-tags]", error);
    return Response.json({ error: "Topik gagal dimuat." }, { status: 500 });
  }
}
