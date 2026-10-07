create extension if not exists pg_trgm with schema extensions;

alter table public.posts add column if not exists search_vector tsvector;
alter table public.public_decks add column if not exists search_vector tsvector;

create or replace function public.update_post_search_vector()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.body_md, '')), 'C');
  return new;
end;
$$;

create or replace function public.update_public_deck_search_vector()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.tags, ' '), '')), 'B');
  return new;
end;
$$;

drop trigger if exists posts_search_vector_trigger on public.posts;
create trigger posts_search_vector_trigger
before insert or update of title, excerpt, body_md on public.posts
for each row execute function public.update_post_search_vector();

drop trigger if exists public_decks_search_vector_trigger on public.public_decks;
create trigger public_decks_search_vector_trigger
before insert or update of title, description, tags on public.public_decks
for each row execute function public.update_public_deck_search_vector();

update public.posts
set search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(excerpt, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(body_md, '')), 'C')
where search_vector is null;

update public.public_decks
set search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(array_to_string(tags, ' '), '')), 'B')
where search_vector is null;

create index if not exists posts_search_vector_gin
  on public.posts using gin (search_vector);
create index if not exists public_decks_search_vector_gin
  on public.public_decks using gin (search_vector);

create index if not exists profiles_username_trgm_gin
  on public.profiles using gin (lower(username) extensions.gin_trgm_ops);
create index if not exists profiles_display_name_trgm_gin
  on public.profiles using gin (lower(display_name) extensions.gin_trgm_ops);
create index if not exists posts_title_trgm_gin
  on public.posts using gin (lower(title) extensions.gin_trgm_ops);
create index if not exists public_decks_title_trgm_gin
  on public.public_decks using gin (lower(title) extensions.gin_trgm_ops);
