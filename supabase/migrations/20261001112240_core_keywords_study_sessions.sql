-- Phase 1: additive data model for AI-selected core concepts and study sessions.
-- Authentication is handled by Better Auth. These tables are server-only:
-- application endpoints must validate ownership before every read/write.

alter table public.candidate_keywords
  add column if not exists content_type text,
  add column if not exists is_core boolean not null default false,
  add column if not exists importance_score smallint,
  add column if not exists why_important text,
  add column if not exists topic_label text,
  add column if not exists core_overridden_by_user boolean not null default false;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'candidate_keywords_content_type_check'
      and conrelid = 'public.candidate_keywords'::regclass
  ) then
    alter table public.candidate_keywords
      add constraint candidate_keywords_content_type_check
      check (content_type is null or content_type in ('hafalan', 'konsep', 'prosedur', 'penerapan'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'candidate_keywords_importance_score_check'
      and conrelid = 'public.candidate_keywords'::regclass
  ) then
    alter table public.candidate_keywords
      add constraint candidate_keywords_importance_score_check
      check (importance_score is null or importance_score between 0 and 100);
  end if;
end
$migration$;

alter table public.decks
  add column if not exists study_goal text;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'decks_study_goal_check'
      and conrelid = 'public.decks'::regclass
  ) then
    alter table public.decks
      add constraint decks_study_goal_check
      check (study_goal is null or study_goal in ('hafalan', 'konsep', 'soal'));
  end if;
end
$migration$;

create table if not exists public.keyword_progress (
  user_id text not null references public."user"(id) on delete cascade,
  keyword_id uuid not null references public.candidate_keywords(id) on delete cascade,
  status text not null default 'baru'
    check (status in ('baru', 'belajar', 'dikuasai')),
  score smallint not null default 0
    check (score between 0 and 100),
  last_studied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, keyword_id)
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public."user"(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  goal text not null
    check (goal in ('hafalan', 'konsep', 'soal')),
  status text not null default 'active'
    check (status in ('active', 'completed', 'abandoned')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.study_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  keyword_id uuid not null references public.candidate_keywords(id) on delete cascade,
  method text not null
    check (method in ('flashcard', 'jelaskan_balik', 'skenario')),
  position smallint not null
    check (position > 0),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'skipped')),
  result_score smallint
    check (result_score is null or result_score between 0 and 100),
  payload jsonb not null default '{}'::jsonb,
  unique (session_id, position)
);

create index if not exists candidate_keywords_core_topic_idx
  on public.candidate_keywords(document_id, is_core, topic_label);
create index if not exists keyword_progress_keyword_idx
  on public.keyword_progress(keyword_id);
create index if not exists keyword_progress_user_status_score_idx
  on public.keyword_progress(user_id, status, score);
create index if not exists study_sessions_user_deck_status_idx
  on public.study_sessions(user_id, deck_id, status, created_at desc);
create index if not exists study_sessions_deck_idx
  on public.study_sessions(deck_id);
create index if not exists study_session_items_keyword_idx
  on public.study_session_items(keyword_id);

alter table public.keyword_progress enable row level security;
alter table public.study_sessions enable row level security;
alter table public.study_session_items enable row level security;

-- Better Auth does not issue Supabase Auth JWTs. Keep Data API roles out and
-- use the server-side database connection after Better Auth ownership checks.
revoke all on public.keyword_progress from anon, authenticated;
revoke all on public.study_sessions from anon, authenticated;
revoke all on public.study_session_items from anon, authenticated;

grant select, insert, update, delete on public.keyword_progress to service_role;
grant select, insert, update, delete on public.study_sessions to service_role;
grant select, insert, update, delete on public.study_session_items to service_role;
