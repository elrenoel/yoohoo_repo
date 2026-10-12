create schema if not exists private;

create table if not exists private.feed_ranking_config (
  id smallint primary key default 1 check (id = 1),
  like_weight double precision not null default 1,
  comment_weight double precision not null default 3,
  share_weight double precision not null default 5,
  save_weight double precision not null default 4,
  view_weight double precision not null default 0.1,
  hide_weight double precision not null default -5,
  decay_exponent double precision not null default 1.5,
  seen_penalty double precision not null default 0.1,
  exploration_ratio double precision not null default 0.15 check (exploration_ratio between 0 and 0.5),
  recent_candidate_limit integer not null default 800 check (recent_candidate_limit between 100 and 2000),
  followed_candidate_limit integer not null default 300 check (followed_candidate_limit between 0 and 1000),
  trending_candidate_limit integer not null default 200 check (trending_candidate_limit between 0 and 1000)
);

insert into private.feed_ranking_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.user_events (
  id bigint generated always as identity primary key,
  user_id text not null references public."user" (id) on delete cascade,
  item_type text not null check (item_type in ('post', 'deck')),
  item_id uuid not null,
  author_id text not null references public."user" (id) on delete cascade,
  event_type text not null check (event_type in ('view', 'like', 'comment', 'share', 'save', 'hide')),
  dwell_ms integer check (dwell_ms is null or dwell_ms between 0 and 3600000),
  created_at timestamptz not null default now()
);

create index if not exists user_events_user_created_idx
  on public.user_events (user_id, created_at desc);
create index if not exists user_events_item_created_idx
  on public.user_events (item_type, item_id, created_at desc);
create index if not exists user_events_user_item_created_idx
  on public.user_events (user_id, item_type, item_id, created_at desc);

create table if not exists public.seen_items (
  user_id text not null references public."user" (id) on delete cascade,
  item_type text not null check (item_type in ('post', 'deck')),
  item_id uuid not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  view_count integer not null default 1 check (view_count > 0),
  primary key (user_id, item_type, item_id)
);

create index if not exists seen_items_user_last_seen_idx
  on public.seen_items (user_id, last_seen_at desc);

create table if not exists public.user_topic_affinity (
  user_id text not null references public."user" (id) on delete cascade,
  topic text not null check (char_length(topic) between 1 and 80),
  score double precision not null default 0,
  event_count integer not null default 0 check (event_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic)
);

create index if not exists user_topic_affinity_user_score_idx
  on public.user_topic_affinity (user_id, score desc);

create table if not exists public.user_author_affinity (
  user_id text not null references public."user" (id) on delete cascade,
  author_id text not null references public."user" (id) on delete cascade,
  score double precision not null default 0,
  event_count integer not null default 0 check (event_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, author_id)
);

create index if not exists user_author_affinity_user_score_idx
  on public.user_author_affinity (user_id, score desc);

alter table public.user_events enable row level security;
alter table public.seen_items enable row level security;
alter table public.user_topic_affinity enable row level security;
alter table public.user_author_affinity enable row level security;

revoke all on table private.feed_ranking_config from public, anon, authenticated;
revoke all on table public.user_events, public.seen_items, public.user_topic_affinity, public.user_author_affinity from public, anon, authenticated;
revoke all on sequence public.user_events_id_seq from public, anon, authenticated;

create or replace function private.record_user_events(p_user_id text, p_events jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  event_row record;
  resolved_author_id text;
  resolved_tags text[];
  event_weight double precision;
  recorded integer := 0;
  topic_name text;
begin
  if p_user_id is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 100 then
    raise exception 'invalid event batch';
  end if;

  for event_row in
    select * from jsonb_to_recordset(p_events) as event_data(
      item_type text,
      item_id uuid,
      event_type text,
      dwell_ms integer,
      created_at timestamptz
    )
  loop
    resolved_author_id := null;
    resolved_tags := '{}'::text[];

    if event_row.item_type = 'post' then
      select p.author_id, p.tags into resolved_author_id, resolved_tags
      from public.posts p
      where p.id = event_row.item_id and p.status = 'published' and p.deleted_at is null;
    elsif event_row.item_type = 'deck' then
      select d.owner_id, d.tags into resolved_author_id, resolved_tags
      from public.public_decks d
      where d.id = event_row.item_id and d.status = 'published';
    end if;

    if resolved_author_id is null or event_row.event_type not in ('view', 'like', 'comment', 'share', 'save', 'hide') then
      continue;
    end if;

    select case event_row.event_type
      when 'like' then c.like_weight
      when 'comment' then c.comment_weight
      when 'share' then c.share_weight
      when 'save' then c.save_weight
      when 'hide' then c.hide_weight
      else c.view_weight * (1 + least(coalesce(event_row.dwell_ms, 0), 60000)::double precision / 120000)
    end into event_weight
    from private.feed_ranking_config c where c.id = 1;

    insert into public.user_events (user_id, item_type, item_id, author_id, event_type, dwell_ms, created_at)
    values (p_user_id, event_row.item_type, event_row.item_id, resolved_author_id, event_row.event_type,
      case when event_row.event_type = 'view' then greatest(0, least(coalesce(event_row.dwell_ms, 0), 3600000)) else null end,
      least(coalesce(event_row.created_at, now()), now()));

    if event_row.event_type = 'view' then
      insert into public.seen_items (user_id, item_type, item_id)
      values (p_user_id, event_row.item_type, event_row.item_id)
      on conflict (user_id, item_type, item_id) do update
      set last_seen_at = now(), view_count = public.seen_items.view_count + 1;
    end if;

    insert into public.user_author_affinity (user_id, author_id, score, event_count)
    values (p_user_id, resolved_author_id, event_weight, 1)
    on conflict (user_id, author_id) do update
    set score = public.user_author_affinity.score + excluded.score,
        event_count = public.user_author_affinity.event_count + 1,
        updated_at = now();

    foreach topic_name in array resolved_tags loop
      insert into public.user_topic_affinity (user_id, topic, score, event_count)
      values (p_user_id, topic_name, event_weight, 1)
      on conflict (user_id, topic) do update
      set score = public.user_topic_affinity.score + excluded.score,
          event_count = public.user_topic_affinity.event_count + 1,
          updated_at = now();
    end loop;
    recorded := recorded + 1;
  end loop;

  return recorded;
end;
$$;

revoke all on function private.record_user_events(text, jsonb) from public, anon, authenticated;

create or replace function public.get_for_you_feed(
  p_user_id text,
  p_cursor_score double precision default null,
  p_cursor_published_at timestamptz default null,
  p_cursor_item_type text default null,
  p_cursor_item_id uuid default null,
  p_limit integer default 20
)
returns table (
  item_type text,
  item_id uuid,
  author_id text,
  published_at timestamptz,
  final_score double precision,
  exploration_eligible boolean,
  exploration_ratio double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
with config as (
  select * from private.feed_ranking_config where id = 1
),
recent_candidates as (
  (select 'post'::text item_type, p.id item_id, p.author_id, p.tags, p.published_at,
      p.like_count, p.comment_count, p.repost_count
   from public.posts p, config c
   where p.status = 'published' and p.deleted_at is null
   order by p.published_at desc, p.id desc limit (select recent_candidate_limit / 2 from config))
  union all
  (select 'deck'::text, d.id, d.owner_id, d.tags, d.published_at,
      d.like_count, d.comment_count, d.repost_count
   from public.public_decks d, config c
   where d.status = 'published'
   order by d.published_at desc, d.id desc limit (select recent_candidate_limit / 2 from config))
),
followed_candidates as (
  (select 'post'::text, p.id, p.author_id, p.tags, p.published_at,
      p.like_count, p.comment_count, p.repost_count
   from public.posts p
   join public.follows f on f.following_id = p.author_id and f.follower_id = p_user_id
   where p.status = 'published' and p.deleted_at is null
   order by p.published_at desc, p.id desc limit (select followed_candidate_limit / 2 from config))
  union all
  (select 'deck'::text, d.id, d.owner_id, d.tags, d.published_at,
      d.like_count, d.comment_count, d.repost_count
   from public.public_decks d
   join public.follows f on f.following_id = d.owner_id and f.follower_id = p_user_id
   where d.status = 'published'
   order by d.published_at desc, d.id desc limit (select followed_candidate_limit / 2 from config))
),
trending_candidates as (
  (select 'post'::text, p.id, p.author_id, p.tags, p.published_at,
      p.like_count, p.comment_count, p.repost_count
   from public.posts p, config c
   where p.status = 'published' and p.deleted_at is null and p.published_at >= now() - interval '7 days'
   order by (p.like_count*c.like_weight + p.comment_count*c.comment_weight + p.repost_count*c.share_weight) desc, p.published_at desc
   limit (select trending_candidate_limit / 2 from config))
  union all
  (select 'deck'::text, d.id, d.owner_id, d.tags, d.published_at,
      d.like_count, d.comment_count, d.repost_count
   from public.public_decks d, config c
   where d.status = 'published' and d.published_at >= now() - interval '7 days'
   order by (d.like_count*c.like_weight + d.comment_count*c.comment_weight + d.repost_count*c.share_weight) desc, d.published_at desc
   limit (select trending_candidate_limit / 2 from config))
),
candidates as (
  select distinct on (all_candidates.item_type, all_candidates.item_id) all_candidates.*
  from (select * from recent_candidates union all select * from followed_candidates union all select * from trending_candidates) all_candidates
),
scored as (
  select candidate.item_type, candidate.item_id, candidate.author_id, candidate.published_at,
    (
      (candidate.like_count*c.like_weight + candidate.comment_count*c.comment_weight + candidate.repost_count*c.share_weight + coalesce(saved.save_count,0)*c.save_weight + 1)
      / power(greatest(extract(epoch from (now()-candidate.published_at))/3600,0)+2,c.decay_exponent)
    )
    * (1 + least(coalesce(topic.affinity,0)/20,1))
    * (1 + least(greatest(coalesce(author.score,0),0)/20,1))
    * case when seen.item_id is null then 1 else c.seen_penalty end as final_score,
    (candidate.like_count + candidate.comment_count + candidate.repost_count + coalesce(saved.save_count,0) = 0
      and candidate.published_at >= now()-interval '48 hours') as exploration_eligible,
    c.exploration_ratio
  from candidates candidate
  cross join config c
  left join public.user_author_affinity author on author.user_id=p_user_id and author.author_id=candidate.author_id
  left join public.seen_items seen on seen.user_id=p_user_id and seen.item_type=candidate.item_type and seen.item_id=candidate.item_id
  left join lateral (
    select count(*)::integer save_count from public.bookmarks b
    where b.target_type=case when candidate.item_type='deck' then 'public_deck' else 'post' end and b.target_id=candidate.item_id
  ) saved on true
  left join lateral (
    select sum(a.score) affinity from unnest(candidate.tags) tag
    join public.user_topic_affinity a on a.user_id=p_user_id and a.topic=tag
  ) topic on true
)
select scored.item_type, scored.item_id, scored.author_id, scored.published_at, scored.final_score, scored.exploration_eligible, scored.exploration_ratio
from scored
where p_cursor_score is null or (scored.final_score,scored.published_at,scored.item_type,scored.item_id)
  < (p_cursor_score,p_cursor_published_at,p_cursor_item_type,p_cursor_item_id)
order by scored.final_score desc, scored.published_at desc, scored.item_type desc, scored.item_id desc
limit greatest(1,least(p_limit,50))*5;
$$;

revoke all on function public.get_for_you_feed(text, double precision, timestamptz, text, uuid, integer) from public, anon, authenticated;

comment on table public.user_events is 'Server-only polymorphic feed interaction log. No historical interactions are backfilled.';
comment on table public.seen_items is 'Server-maintained view summary used for the For You seen penalty.';
comment on function public.get_for_you_feed(text, double precision, timestamptz, text, uuid, integer) is 'Returns a bounded scored candidate pool for server-side diversity and exploration reranking.';
