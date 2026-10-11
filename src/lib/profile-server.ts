import "server-only";
import { ragSql } from "@/lib/rag/db";
import type { SocialPostItem } from "@/components/posts/PostCard";

export interface PublicProfile {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  createdAt: string;
  counts: { decks: number; posts: number; followers: number; following: number };
  publicDecks: Array<{ slug: string; title: string; tags: string[]; version: number; cardCount: number; completions: number; averageScore: number | null }>;
  posts: SocialPostItem[];
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
    select p.user_id as "userId", p.username, p.display_name as "displayName",
           p.bio, coalesce(p.avatar_url, u.image) as "avatarUrl"
    from public.profiles p
    join public."user" u on u.id = p.user_id
    where p.user_id = ${userId} limit 1
  `;
  return rows[0] ?? null;
}

export async function getPublicProfile(username: string, viewerId = ""): Promise<PublicProfile | null> {
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
      from public.public_decks d left join public.decks source on source.id=d.source_deck_id
      where d.owner_id=${profile.userId} and d.status='published'
        and (d.source_deck_id is null or (source.visibility='public' and source.deleted_at is null))
      order by coalesce(source.shared_at,d.published_at) desc
    `;
    decks = publicDecks.length;
    const publishedPostRows = await tx`
      select p.id,p.slug,p.title,coalesce(nullif(p.body,''),p.excerpt) summary,p.tags,
        p.published_at,p.like_count,p.comment_count,p.repost_count,
        exists(select 1 from public.likes l where l.user_id=${viewerId} and l.target_type='post' and l.target_id=p.id) liked_by_me,
        exists(select 1 from public.bookmarks b where b.user_id=${viewerId} and b.target_type='post' and b.target_id=p.id) bookmarked_by_me,
        exists(select 1 from public.reposts r where r.user_id=${viewerId} and r.target_type='post' and r.target_id=p.id) reposted_by_me,
        coalesce((select json_agg(json_build_object('id',i.id,'url','/api/post-images/'||i.id,'width',i.width,'height',i.height,'altText',i.alt_text) order by i.position) from public.post_images i where i.post_id=p.id),'[]'::json) images,
        case when d.id is null then null else json_build_object('slug',d.slug,'title',d.title,'description',d.description,'tags',d.tags,'color',p.embedded_deck_color) end embedded_deck
      from public.posts p
      left join public.public_decks d on d.id=p.embedded_public_deck_id and d.status='published'
      where p.author_id=${profile.userId} and p.status='published' and p.deleted_at is null
      order by p.published_at desc
    `;
    const publishedPosts:SocialPostItem[]=publishedPostRows.map(row=>({
      id:String(row.id),type:"post",slug:String(row.slug),title:String(row.title),summary:String(row.summary??""),excerpt:String(row.summary??""),
      tags:Array.isArray(row.tags)?row.tags:[],publishedAt:new Date(row.published_at).toISOString(),
      author:{username:profile.username,displayName:profile.displayName,avatarUrl:profile.avatarUrl},
      likeCount:Number(row.like_count??0),commentCount:Number(row.comment_count??0),repostCount:Number(row.repost_count??0),
      likedByMe:Boolean(row.liked_by_me),bookmarkedByMe:Boolean(row.bookmarked_by_me),repostedByMe:Boolean(row.reposted_by_me),
      images:Array.isArray(row.images)?row.images:[],embeddedDeck:row.embedded_deck??null,
    }));
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

export async function getIsFollowing(viewerId:string|undefined,targetId:string){if(!viewerId||viewerId===targetId)return false;const sql=ragSql();const rows=await sql<{exists:boolean}[]>`select exists(select 1 from public.follows where follower_id=${viewerId} and following_id=${targetId}) exists`;return rows[0]?.exists??false}
