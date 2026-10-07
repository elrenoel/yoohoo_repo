-- Your Desk upgrade: priority flag for decks + created_at invariant.
--
-- is_priority means "prioritas dipelajari lagi": high-priority decks sort to the
-- top of Your Desk and get the red strip / filled star on their card.
alter table public.decks
  add column if not exists is_priority boolean not null default false;

-- created_at guardrail.
-- The base migration created it as `timestamptz not null default now()` and
-- backfilled pre-existing decks from documents.created_at, so no row is
-- expected to violate these constraints. The statements below are defensive:
-- they re-assert the default/not-null and backfill any historical row that
-- slipped through (e.g. a manual insert that bypassed the default), falling
-- back to updated_at and finally now() so the column is never empty.
alter table public.decks
  alter column created_at set default now();

update public.decks
  set created_at = coalesce(updated_at, now())
  where created_at is null;

alter table public.decks
  alter column created_at set not null;

-- Supports the list query `order by is_priority desc, created_at desc`.
create index if not exists decks_user_priority_idx
  on public.decks (user_id, is_priority desc, created_at desc);
