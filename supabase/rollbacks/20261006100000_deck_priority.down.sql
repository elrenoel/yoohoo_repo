-- Rollback: 20261006100000_deck_priority
-- created_at default/not-null are left as the base migration defined them.
drop index if exists public.decks_user_priority_idx;
alter table public.decks drop column if exists is_priority;
