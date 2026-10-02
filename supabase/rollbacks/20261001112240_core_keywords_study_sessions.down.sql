-- Manual rollback for 20261001112240_core_keywords_study_sessions.sql.
-- This removes study-session data created after the up migration.

drop table if exists public.study_session_items;
drop table if exists public.study_sessions;
drop table if exists public.keyword_progress;

alter table public.decks
  drop column if exists study_goal;

alter table public.candidate_keywords
  drop column if exists core_overridden_by_user,
  drop column if exists topic_label,
  drop column if exists why_important,
  drop column if exists importance_score,
  drop column if exists is_core,
  drop column if exists content_type;
