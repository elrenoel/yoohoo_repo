import "server-only";
import { ragSql } from "@/lib/rag/db";

export interface PublicProfile {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  createdAt: string;
  counts: { decks: number; posts: number; followers: number; following: number };
  publicDecks: Array<{ slug: string; title: string; tags: string[]; version: number; cardCount: number; completions: number; averageScore: number | null }>;
  posts: Array<{ id: string; slug: string; title: string; excerpt: string; status: "published"; publishedAt: string }>;
}

export interface OwnProfile {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
}

export async function getOwnProfile(userId: string): Promise<OwnProfile | null> {
  const sql = ragSql();
  const rows = await sql<OwnProfile[]>`
    select user_id as "userId", username, display_name as "displayName",
           bio, avatar_url as "avatarUrl"
    from public.profiles where user_id = ${userId} limit 1
  `;
  return rows[0] ?? null;
}

export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const sql = ragSql();
  return sql.begin(async (tx) => {
    const rows = await tx<Omit<PublicProfile, "counts">[]>`
      select p.user_id as "userId", p.username, p.display_name as "displayName",
             p.bio, coalesce(p.avatar_url, u.image) as "avatarUrl", p.created_at::text as "createdAt"
      from public.profiles p
      join public."user" u on u.id = p.user_id
      where lower(p.username) = lower(${username}) limit 1
    `;
    const profile = rows[0];
    if (!profile) return null;

    // Capability detection keeps Step 1 compatible with later social migrations,
    // while never treating today's private decks as public by mistake.
    const capability = await tx<{ deckVisibility: boolean; posts: boolean; follows: boolean }[]>`
      select
        exists(select 1 from information_schema.columns where table_schema='public' and table_name='decks' and column_name='visibility') as "deckVisibility",
        to_regclass('public.posts') is not null as posts,
        to_regclass('public.follows') is not null as follows
    `;
    let decks = 0, posts = 0, followers = 0, following = 0;
    const publicDecks = await tx<{slug:string;title:string;tags:string[];version:number;cardCount:number;completions:number;averageScore:number|null}[]>`
      select d.slug,d.title,d.tags,d.version,
        (select count(*)::int from public.public_deck_cards c where c.public_deck_id=d.id) as "cardCount",
        (select count(distinct a.user_id)::int from public.public_deck_attempts a where a.public_deck_id=d.id) as completions,
        (select case when count(*)>=5 then round(avg(a.score::numeric/nullif(a.total,0))*100,1)::float else null end from public.public_deck_attempts a where a.public_deck_id=d.id) as "averageScore"
      from public.public_decks d where d.owner_id=${profile.userId} and d.status='published' order by d.published_at desc
    `;
    decks = publicDecks.length;
    const publishedPosts = await tx<{id:string;slug:string;title:string;excerpt:string;status:"published";publishedAt:string}[]>`select id,slug,title,coalesce(nullif(body,''),excerpt) excerpt,status,published_at::text as "publishedAt" from public.posts where author_id=${profile.userId} and status='published' and deleted_at is null order by published_at desc`;
    posts = publishedPosts.length;
    if (capability[0]?.follows) {
      const counts = await tx<{ followers: number; following: number }[]>`
        select
          (select count(*)::int from public.follows where following_id = ${profile.userId}) as followers,
          (select count(*)::int from public.follows where follower_id = ${profile.userId}) as following
      `;
      followers = counts[0]?.followers ?? 0;
      following = counts[0]?.following ?? 0;
    }
    return { ...profile, counts: { decks, posts, followers, following }, publicDecks, posts: publishedPosts };
  });
}

export async function getOwnerDrafts(userId:string){const sql=ragSql();return sql<{id:string;slug:string;title:string;excerpt:string;status:"draft";updatedAt:string}[]>`select id,slug,title,excerpt,status,updated_at::text as "updatedAt" from public.posts where author_id=${userId} and status='draft' and deleted_at is null order by updated_at desc`}
export async function getIsFollowing(viewerId:string|undefined,targetId:string){if(!viewerId||viewerId===targetId)return false;const sql=ragSql();const rows=await sql<{exists:boolean}[]>`select exists(select 1 from public.follows where follower_id=${viewerId} and following_id=${targetId}) exists`;return rows[0]?.exists??false}
