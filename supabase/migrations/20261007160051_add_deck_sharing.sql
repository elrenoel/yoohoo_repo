alter table public.decks
  add column if not exists visibility text not null default 'private',
  add column if not exists slug text,
  add column if not exists shared_at timestamptz;

do $$ begin
  alter table public.decks add constraint decks_visibility_check
    check (visibility in ('private', 'unlisted', 'public'));
exception when duplicate_object then null; end $$;

create unique index if not exists decks_slug_uidx
  on public.decks (slug) where slug is not null;

create index if not exists idx_decks_public
  on public.decks (shared_at desc, id desc)
  where visibility = 'public' and deleted_at is null;

alter table public.quiz_attempts add column if not exists user_id text;

do $$ begin
  alter table public.quiz_attempts add constraint quiz_attempts_user_id_fkey
    foreign key (user_id) references public."user"(id) on delete cascade;
exception when duplicate_object then null; end $$;

create index if not exists quiz_attempts_user_created_idx
  on public.quiz_attempts (user_id, created_at desc, id desc)
  where user_id is not null;
