create extension if not exists unaccent with schema extensions;

create or replace function private.immutable_unaccent(p_value text)
returns text language sql immutable strict parallel safe set search_path=''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, p_value) $$;

create or replace function private.normalize_tags(p_values text[])
returns text[] language sql immutable parallel safe set search_path=''
as $$
  select coalesce(array_agg(lower(trim(value)) order by lower(trim(value))), '{}'::text[])
  from unnest(coalesce(p_values, '{}'::text[])) value
  where trim(value) <> ''
$$;

revoke all on function private.immutable_unaccent(text) from public, anon, authenticated;
revoke all on function private.normalize_tags(text[]) from public, anon, authenticated;

create index if not exists profiles_username_unaccent_trgm_gin
  on public.profiles using gin (private.immutable_unaccent(lower(username)) extensions.gin_trgm_ops);
create index if not exists profiles_display_name_unaccent_trgm_gin
  on public.profiles using gin (private.immutable_unaccent(lower(display_name)) extensions.gin_trgm_ops);
create index if not exists posts_normalized_tags_gin
  on public.posts using gin (private.normalize_tags(tags))
  where status='published' and deleted_at is null;
create index if not exists public_decks_normalized_tags_gin
  on public.public_decks using gin (private.normalize_tags(tags))
  where status='published';
