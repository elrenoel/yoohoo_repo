alter table public.posts add column if not exists body text not null default '';
alter table public.posts add column if not exists tags text[] not null default '{}';

update public.posts set body=left(body_md,500) where body='' and body_md<>'';

do $$ begin
  if not exists(select 1 from pg_constraint where conname='posts_body_length_check' and conrelid='public.posts'::regclass) then
    alter table public.posts add constraint posts_body_length_check check(char_length(body)<=500);
  end if;
  if not exists(select 1 from pg_constraint where conname='posts_tags_check' and conrelid='public.posts'::regclass) then
    alter table public.posts add constraint posts_tags_check check(cardinality(tags)<=3 and array_to_string(tags,',')=lower(array_to_string(tags,',')));
  end if;
end $$;

create table if not exists public.post_images(
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  owner_id text not null references public."user"(id) on delete cascade,
  storage_path text not null unique,
  width integer not null check(width>0 and width<=1600),
  height integer not null check(height>0 and height<=1600),
  alt_text text check(alt_text is null or char_length(alt_text)<=200),
  position smallint not null default 1 check(position between 1 and 4),
  created_at timestamptz not null default now()
);
create index if not exists post_images_post_position_idx on public.post_images(post_id,position);
create index if not exists post_images_staged_idx on public.post_images(owner_id,created_at) where post_id is null;
alter table public.post_images enable row level security;
comment on table public.post_images is 'Server-managed S3 image metadata. Staged rows have null post_id and are owner-scoped by Better Auth routes.';

create table if not exists public.public_deck_progress(
  user_id text not null references public."user"(id) on delete cascade,
  card_id uuid not null references public.public_deck_cards(id) on delete cascade,
  status text not null check(status in ('new','learning','known')),
  updated_at timestamptz not null default now(),
  primary key(user_id,card_id)
);
create index if not exists public_deck_progress_card_idx on public.public_deck_progress(card_id);
alter table public.public_deck_progress enable row level security;
comment on table public.public_deck_progress is 'Private per-user public deck flashcard progress; server routes always filter user_id from Better Auth session.';

create index if not exists public_deck_attempts_user_created_idx on public.public_deck_attempts(user_id,created_at desc,id desc);

alter table public.public_deck_attempt_answers drop constraint if exists public_deck_attempt_answers_attempt_id_fkey;
alter table public.public_deck_attempt_answers add constraint public_deck_attempt_answers_attempt_id_fkey
  foreign key(attempt_id) references public.public_deck_attempts(id) on delete cascade;

create or replace function public.update_post_search_vector()
returns trigger language plpgsql set search_path='' as $$
begin
  new.search_vector := setweight(to_tsvector('simple',coalesce(new.title,'')),'A') ||
    setweight(to_tsvector('simple',coalesce(new.excerpt,'')),'B') ||
    setweight(to_tsvector('simple',coalesce(new.body,'')),'B') ||
    setweight(to_tsvector('simple',coalesce(new.body_md,'')),'C') ||
    setweight(to_tsvector('simple',coalesce(array_to_string(new.tags,' '),'')),'B');
  return new;
end; $$;
drop trigger if exists posts_search_vector_trigger on public.posts;
create trigger posts_search_vector_trigger before insert or update of title,excerpt,body,body_md,tags on public.posts
for each row execute function public.update_post_search_vector();
update public.posts set updated_at=updated_at;
