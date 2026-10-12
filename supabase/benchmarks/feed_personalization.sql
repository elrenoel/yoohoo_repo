-- Synthetic For You benchmark (10k or 100k published posts).
-- NEVER run this on production. Use `supabase start`/local psql or a separate
-- disposable project. The script refuses to run without both explicit guards.
--
-- psql example (local only):
--   psql "$LOCAL_DATABASE_URL" --set=benchmark_size=10000 \
--     --file=supabase/benchmarks/feed_personalization.sql
-- Repeat with 100000 after resetting the disposable database.

select set_config('app.feed_benchmark_enabled', 'on', false);
select set_config('app.feed_benchmark_size', :'benchmark_size', false);

do $$
declare
  requested_size integer := nullif(current_setting('app.feed_benchmark_size', true), '')::integer;
begin
  if current_setting('app.feed_benchmark_enabled', true) is distinct from 'on' then
    raise exception 'Refusing synthetic seed: set app.feed_benchmark_enabled=on in a local/disposable database';
  end if;
  if requested_size not in (10000, 100000) then
    raise exception 'app.feed_benchmark_size must be 10000 or 100000';
  end if;
end;
$$;

insert into public."user" (id, name, email, email_verified, is_demo)
values ('feed-benchmark-user', 'Feed Benchmark', 'feed-benchmark@invalid.local', true, true)
on conflict (id) do update set updated_at = now();

insert into public.profiles (user_id, username, display_name, bio, is_demo)
values ('feed-benchmark-user', 'feed-benchmark', 'Feed Benchmark', 'Synthetic benchmark account', true)
on conflict (user_id) do update set updated_at = now();

delete from public.posts where slug like 'feed-benchmark-%';

insert into public.posts (
  author_id, slug, title, excerpt, body_md, body, status, published_at,
  tags, like_count, comment_count, repost_count, is_demo
)
select
  'feed-benchmark-user',
  'feed-benchmark-' || n,
  'Synthetic feed item ' || n,
  'Synthetic benchmark data',
  'Synthetic benchmark data',
  'Synthetic benchmark data',
  'published',
  now() - ((n % 2160) || ' minutes')::interval,
  array['benchmark', 'topic-' || (n % 20)],
  n % 101,
  n % 17,
  n % 11,
  true
from generate_series(
  1,
  current_setting('app.feed_benchmark_size')::integer
) as series(n);

analyze public.posts;

explain (analyze, buffers, settings, format text)
select *
from public.get_for_you_feed(
  'feed-benchmark-user',
  null,
  null,
  null,
  null,
  20
);

