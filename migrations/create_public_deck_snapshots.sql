create table if not exists public.public_decks (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public."user"(id) on delete cascade,
  source_deck_id uuid references public.decks(id) on delete set null,
  slug text not null,
  title text not null,
  description text not null default '',
  tags text[] not null default '{}',
  language text not null default 'id',
  status text not null default 'published' check (status in ('published','unpublished')),
  version integer not null default 1 check (version > 0),
  view_count bigint not null default 0 check (view_count >= 0),
  fork_count bigint not null default 0 check (fork_count >= 0),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_decks_slug_format check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint public_decks_title_length check (char_length(title) between 1 and 120),
  constraint public_decks_description_length check (char_length(description) <= 500),
  constraint public_decks_tags_limit check (cardinality(tags) <= 8),
  constraint public_decks_language_length check (char_length(language) between 2 and 10)
);
create unique index if not exists public_decks_slug_uidx on public.public_decks(slug);
create unique index if not exists public_decks_source_active_uidx on public.public_decks(source_deck_id) where source_deck_id is not null;
create index if not exists public_decks_owner_status_idx on public.public_decks(owner_id, status);
create index if not exists public_decks_status_published_idx on public.public_decks(status, published_at desc);

create table if not exists public.public_deck_cards (
  id uuid primary key default gen_random_uuid(),
  public_deck_id uuid not null references public.public_decks(id) on delete cascade,
  position integer not null check (position > 0),
  front text not null,
  back text not null,
  content_type text not null default 'concept',
  unique(public_deck_id, position)
);
create index if not exists public_deck_cards_deck_idx on public.public_deck_cards(public_deck_id, position);

create table if not exists public.public_deck_questions (
  id uuid primary key default gen_random_uuid(),
  public_deck_id uuid not null references public.public_decks(id) on delete cascade,
  position integer not null check (position > 0),
  question text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  correct_index integer not null check (correct_index >= 0),
  explanation text,
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  unique(public_deck_id, position),
  constraint public_deck_questions_correct_range check (correct_index < jsonb_array_length(options))
);
create index if not exists public_deck_questions_deck_idx on public.public_deck_questions(public_deck_id, position);

create table if not exists public.public_deck_attempts (
  id uuid primary key default gen_random_uuid(),
  public_deck_id uuid not null references public.public_decks(id) on delete cascade,
  user_id text not null references public."user"(id) on delete cascade,
  score integer not null check (score >= 0),
  total integer not null check (total > 0 and score <= total),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now()
);
create index if not exists public_deck_attempts_deck_idx on public.public_deck_attempts(public_deck_id, created_at desc);
create index if not exists public_deck_attempts_user_idx on public.public_deck_attempts(user_id, created_at desc);

create table if not exists public.public_deck_attempt_answers (
  attempt_id uuid not null references public.public_deck_attempts(id) on delete cascade,
  question_id uuid not null references public.public_deck_questions(id) on delete cascade,
  selected_index integer,
  is_correct boolean not null,
  time_taken_ms integer check (time_taken_ms is null or time_taken_ms >= 0),
  primary key(attempt_id, question_id)
);
create index if not exists public_deck_attempt_answers_question_idx on public.public_deck_attempt_answers(question_id);

alter table public.public_decks enable row level security;
alter table public.public_deck_cards enable row level security;
alter table public.public_deck_questions enable row level security;
alter table public.public_deck_attempts enable row level security;
alter table public.public_deck_attempt_answers enable row level security;
revoke all on public.public_decks, public.public_deck_cards, public.public_deck_questions, public.public_deck_attempts, public.public_deck_attempt_answers from anon, authenticated;

create or replace function private.touch_public_deck_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function private.touch_public_deck_updated_at() from public, anon, authenticated;
drop trigger if exists public_decks_touch_updated_at on public.public_decks;
create trigger public_decks_touch_updated_at before update on public.public_decks for each row execute function private.touch_public_deck_updated_at();
