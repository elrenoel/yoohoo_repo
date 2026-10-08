alter table public."user"
  add column if not exists is_demo boolean not null default false;

alter table public.profiles
  add column if not exists is_demo boolean not null default false;

alter table public.public_decks
  add column if not exists is_demo boolean not null default false;

alter table public.posts
  add column if not exists is_demo boolean not null default false;
