-- Feed hardening. The application is the only caller of these routines.

alter table public.user_events
  drop constraint if exists user_events_dwell_ms_check;
alter table public.user_events
  add constraint user_events_dwell_ms_check
  check (dwell_ms is null or dwell_ms between 0 and 300000) not valid;
alter table public.user_events validate constraint user_events_dwell_ms_check;

create index if not exists user_events_created_at_idx
  on public.user_events (created_at);

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
  if p_user_id is null
    or jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) < 1
    or jsonb_array_length(p_events) > 50
  then
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
    if event_row.item_type not in ('post', 'deck')
      or event_row.event_type not in ('view', 'like', 'comment', 'share', 'save', 'hide')
    then
      continue;
    end if;

    resolved_author_id := null;
    resolved_tags := '{}'::text[];

    if event_row.item_type = 'post' then
      select p.author_id, p.tags into resolved_author_id, resolved_tags
      from public.posts p
      where p.id = event_row.item_id and p.status = 'published' and p.deleted_at is null;
    else
      select d.owner_id, d.tags into resolved_author_id, resolved_tags
      from public.public_decks d
      where d.id = event_row.item_id and d.status = 'published';
    end if;

    if resolved_author_id is null then
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
    values (
      p_user_id,
      event_row.item_type,
      event_row.item_id,
      resolved_author_id,
      event_row.event_type,
      case when event_row.event_type = 'view'
        then greatest(0, least(coalesce(event_row.dwell_ms, 0), 300000))
        else null
      end,
      least(coalesce(event_row.created_at, now()), now())
    );

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

-- likes/bookmarks/reposts are unique per user and target through their primary
-- keys. These indexes also make the per-item counts used by ranking explicit.
create unique index if not exists likes_user_target_unique_idx
  on public.likes (user_id, target_type, target_id);
create unique index if not exists bookmarks_user_target_unique_idx
  on public.bookmarks (user_id, target_type, target_id);
create unique index if not exists reposts_user_target_unique_idx
  on public.reposts (user_id, target_type, target_id);

-- Defense in depth: functions are server-internal even when located in an
-- exposed schema. PUBLIC is revoked separately because anon/authenticated
-- inherit its default EXECUTE privilege.
revoke execute on function private.record_user_events(text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.get_for_you_feed(
  text, double precision, timestamptz, text, uuid, integer
) from public, anon, authenticated;

revoke all on table public.user_events, public.seen_items,
  public.user_topic_affinity, public.user_author_affinity
  from public, anon, authenticated;
revoke all on sequence public.user_events_id_seq
  from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'feed-user-events-retention-45d';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'feed-user-events-retention-45d',
    '17 3 * * *',
    $cron$delete from public.user_events where created_at < now() - interval '45 days'$cron$
  );
end;
$$;

