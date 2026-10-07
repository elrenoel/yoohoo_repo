-- Migration: flashcards_document_id_idx
-- Unique index lama flashcards (document_id, term) di-drop di migration
-- flashcard_multi_document_items; index leading-column document_id ikut hilang.
-- Query flashcards per dokumen (hitung kartu di deck) tetap sering, jadi buat
-- index pengganti.

CREATE INDEX IF NOT EXISTS flashcards_document_id_idx
  ON public.flashcards (document_id);
