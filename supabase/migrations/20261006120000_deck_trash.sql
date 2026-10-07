-- Deck trash: soft-delete untuk decks + pembersihan trash dokumen lama.
-- Aplikasi memakai soft delete (deleted_at IS NOT NULL = ada di Trash);
-- baris lebih tua dari 30 hari di-purge permanen oleh aplikasi (cek saat load).

-- 1) Kosongkan seluruh isi trash dokumen lama (documents.deleted_at).
--    Tabel anak (document_chunks, candidate_keywords, flashcards, quiz_*, dst.)
--    dibersihkan oleh ON DELETE CASCADE. Kolom documents.deleted_at DIPERTAHANKAN
--    karena ±25 query RAG/pipeline memakainya sebagai filter defensif; setelah
--    migration ini nilainya selalu NULL.
delete from public.documents where deleted_at is not null;

-- 2) Deck trash: deleted_at IS NOT NULL = deck sedang di Trash.
alter table public.decks add column if not exists deleted_at timestamptz;

-- Partial index: query list deck aktif (Your Desk/sidebar) hanya menyentuh
-- baris deleted_at is null; filter ownership tetap di app layer (Better Auth).
create index if not exists decks_user_active_idx
  on public.decks (user_id, is_priority desc, created_at desc)
  where deleted_at is null;

create index if not exists decks_user_trashed_idx
  on public.decks (user_id, deleted_at desc)
  where deleted_at is not null;
