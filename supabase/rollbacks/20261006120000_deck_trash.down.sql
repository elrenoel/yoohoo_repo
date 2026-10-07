drop index if exists public.decks_user_trashed_idx;
drop index if exists public.decks_user_active_idx;
alter table public.decks drop column if exists deleted_at;
-- Pemulihan isi trash tidak mungkin (data sudah dihapus permanen).
