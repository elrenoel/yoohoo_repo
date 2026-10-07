import { ragSql } from "@/lib/rag/db";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`explore-tags:${ip}`, 30, 60_000).allowed) return Response.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  try {
    const sql = ragSql();
    const rows = await sql<{ tag: string; count: number }[]>`
      with published_tags as (
        select unnest(d.tags) tag from public.public_decks d where d.status='published'
        union all
        select unnest(d.tags) tag from public.posts p join public.public_decks d
          on d.id=p.embedded_public_deck_id and d.status='published'
        where p.status='published' and p.deleted_at is null
      ) select lower(tag) tag, count(*)::int count from published_tags
        where length(trim(tag)) between 1 and 40 group by lower(tag) order by count(*) desc, lower(tag) limit 20`;
    return Response.json({ tags: rows }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("[explore-tags]", error);
    return Response.json({ error: "Topik gagal dimuat." }, { status: 500 });
  }
}
