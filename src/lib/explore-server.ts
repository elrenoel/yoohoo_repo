import "server-only";
import { unstable_cache } from "next/cache";
import { ragSql } from "@/lib/rag/db";

export const getExploreTags = unstable_cache(async () => {
  const rows = await ragSql()<{tag:string;count:number}[]>`with published_tags as (
    select unnest(private.normalize_tags(d.tags)) tag from public.public_decks d
      left join public.decks source on source.id=d.source_deck_id
      where d.status='published' and (d.source_deck_id is null or (source.visibility='public' and source.deleted_at is null))
        and not exists(select 1 from public.posts p where p.embedded_public_deck_id=d.id and p.status='published' and p.deleted_at is null)
    union all
    select unnest(private.normalize_tags(p.tags||coalesce(d.tags,'{}'::text[]))) tag from public.posts p
      left join public.public_decks d on d.id=p.embedded_public_deck_id and d.status='published'
      where p.status='published' and p.deleted_at is null
  ) select tag,count(*)::int count from published_tags
    where length(tag) between 1 and 40 group by tag
    order by count(*) desc,tag limit 20`;
  return rows;
}, ["explore-tags-v2"], { revalidate: 300 });

export const getFeaturedPost = unstable_cache(async () => {
  const rows = await ragSql()`select po.id::text id,'post'::text type,po.slug,po.title,
    coalesce(nullif(po.body,''),po.excerpt) summary,po.tags,po.published_at,
    p.username,p.display_name,coalesce(p.avatar_url,u.image) avatar_url,0::int completion_count,null::float8 average_score,
    (po.like_count + po.comment_count*3 + po.repost_count*5)::float8 popularity
    from public.posts po join public.profiles p on p.user_id=po.author_id
    join public."user" u on u.id=p.user_id
    where po.status='published' and po.deleted_at is null
    order by popularity desc,po.published_at desc limit 1`;
  return rows[0] ?? null;
}, ["explore-featured-post-v1"], { revalidate: 300, tags: ["explore-featured"] });

export const getLearnersToDiscover = unstable_cache(async (viewerId:string) => {
  return ragSql()`select p.user_id::text id,'people'::text type,p.username slug,p.display_name title,
    p.bio summary,'{}'::text[] tags,p.created_at published_at,p.username,p.display_name,coalesce(p.avatar_url,u.image) avatar_url,
    0::int completion_count,null::float8 average_score,count(f.follower_id)::float8 popularity
    from public.profiles p join public."user" u on u.id=p.user_id
    left join public.follows f on f.following_id=p.user_id
    where (${viewerId}='' or p.user_id<>${viewerId})
      and (${viewerId}='' or not exists(select 1 from public.follows own where own.follower_id=${viewerId} and own.following_id=p.user_id))
    group by p.user_id,p.username,p.display_name,p.bio,p.created_at,p.avatar_url,u.image
    order by count(f.follower_id) desc,p.created_at desc,p.user_id limit 5`;
}, ["explore-learners-v1"], { revalidate: 300, tags: ["explore-learners"] });
