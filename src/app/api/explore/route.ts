import { ZodError } from "zod";
import { ragSql } from "@/lib/rag/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { decodeExploreCursor, encodeExploreCursor, exploreQuerySchema } from "@/lib/explore";

type Row = {
  id: string; type: "deck" | "post" | "people"; slug: string; title: string;
  summary: string; tags: string[]; published_at: Date | string; username: string;
  display_name: string; avatar_url: string | null; completion_count: number;
  average_score: number | null; popularity: number;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = exploreQuerySchema.parse(Object.fromEntries(["q", "tab", "tag", "sort"].map(key => [key, url.searchParams.get(key) ?? undefined])));
    const cursorParam = url.searchParams.get("cursor");
    const cursor = decodeExploreCursor(cursorParam);
    if (cursorParam && (!cursor || cursor.sort !== parsed.sort)) return Response.json({ error: "Cursor tidak valid." }, { status: 400 });
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rate = checkRateLimit(`explore:${ip}`, 60, 60_000);
    if (!rate.allowed) return Response.json({ error: "Terlalu banyak pencarian. Coba lagi sebentar." }, { status: 429 });

    const sql = ragSql();
    const q = parsed.q.toLowerCase();
    const query = q ? sql`websearch_to_tsquery('simple', ${q})` : sql`null::tsquery`;
    const tag = parsed.tag;
    const cursorFilter = cursor
      ? parsed.sort === "popular"
        ? sql`and (popularity, published_at, id, type) < (${cursor.value}, ${cursor.publishedAt}, ${cursor.id}, ${cursor.type})`
        : parsed.sort === "proven"
          ? sql`and (coalesce(average_score, -1), published_at, id, type) < (${cursor.value}, ${cursor.publishedAt}, ${cursor.id}, ${cursor.type})`
          : sql`and (published_at, id, type) < (${cursor.publishedAt}, ${cursor.id}, ${cursor.type})`
      : sql``;

    const rows = await sql<Row[]>`
      with deck_stats as (
        select public_deck_id, count(*)::int completion_count,
          avg(score::numeric / nullif(total, 0) * 100)::float8 average_score,
          count(*) filter (where created_at >= now() - interval '30 days')::int attempts_30d
        from public.public_deck_attempts group by public_deck_id
      ), results as (
        select d.id::text id, 'deck'::text type, d.slug, d.title, d.description summary,
          d.tags, d.published_at, p.username, p.display_name, p.avatar_url,
          coalesce(s.completion_count, 0)::int completion_count, s.average_score,
          (d.fork_count * 3 + coalesce(s.attempts_30d, 0) + d.view_count * 0.1)::float8 popularity
        from public.public_decks d join public.profiles p on p.user_id=d.owner_id
        left join public.decks source on source.id=d.source_deck_id
        left join deck_stats s on s.public_deck_id=d.id
        where d.status='published' and (d.source_deck_id is null or (source.visibility='public' and source.deleted_at is null))
          and not exists(select 1 from public.posts px where px.embedded_public_deck_id=d.id and px.status='published' and px.deleted_at is null)
          and ${parsed.tab === "all" || parsed.tab === "deck"}
          and (${!q} or d.search_vector @@ ${query} or lower(d.title) % ${q})
          and (${!tag} or ${tag}=any(d.tags))
          and (${parsed.sort !== "proven"} or coalesce(s.completion_count,0) >= 5)
        union all
        select po.id::text, 'post'::text, po.slug, po.title, coalesce(nullif(po.body,''),po.excerpt), po.tags,
          po.published_at, p.username, p.display_name, p.avatar_url, 0, null::float8, 0::float8
        from public.posts po join public.profiles p on p.user_id=po.author_id
        left join public.public_decks ed on ed.id=po.embedded_public_deck_id and ed.status='published'
        where po.status='published' and po.deleted_at is null
          and ${parsed.sort !== "proven" && (parsed.tab === "all" || parsed.tab === "post")}
          and (${!q} or po.search_vector @@ ${query} or lower(po.title) % ${q})
          and (${!tag} or ${tag}=any(coalesce(ed.tags,'{}'::text[])))
        union all
        select p.user_id::text, 'people'::text, p.username, p.display_name, p.bio, '{}'::text[],
          p.created_at, p.username, p.display_name, p.avatar_url, 0, null::float8,
          (select count(*)::float8 from public.follows f where f.following_id=p.user_id)
        from public.profiles p
        where ${parsed.sort !== "proven" && !tag && (parsed.tab === "all" || parsed.tab === "people")}
          and (${!q} or lower(p.username) % ${q} or lower(p.display_name) % ${q} or lower(p.username) like ${`%${q}%`} or lower(p.display_name) like ${`%${q}%`})
      ), page as (select * from results where true ${cursorFilter})
      select * from page
      order by
        ${parsed.sort === "popular" ? sql`popularity` : parsed.sort === "proven" ? sql`average_score` : sql`extract(epoch from published_at)`} desc,
        published_at desc, id desc, type desc limit 21`;

    const page = rows.slice(0, 20);
    const last = rows.length > 20 ? page.at(-1) : undefined;
    const value = last ? (parsed.sort === "popular" ? Number(last.popularity) : parsed.sort === "proven" ? Number(last.average_score) : new Date(last.published_at).getTime() / 1000) : 0;
    return Response.json({
      items: page.map(row => ({
        id: String(row.id), type: row.type, slug: row.slug, title: row.title, summary: row.summary || "", tags: row.tags || [],
        publishedAt: new Date(row.published_at).toISOString(), author: { username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url },
        completionCount: Number(row.completion_count), averageScore: row.average_score === null ? null : Number(row.average_score), popularity: Number(row.popularity),
      })),
      nextCursor: last ? encodeExploreCursor({ sort: parsed.sort, value, publishedAt: new Date(last.published_at).toISOString(), id: String(last.id), type: last.type }) : null,
    }, { headers: { "Cache-Control": "no-store", "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Filter pencarian tidak valid." }, { status: 400 });
    console.error("[explore]", error);
    return Response.json({ error: "Pencarian gagal dimuat." }, { status: 500 });
  }
}
