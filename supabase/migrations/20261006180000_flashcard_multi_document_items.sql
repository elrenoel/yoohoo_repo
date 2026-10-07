-- Migration: flashcard_multi_document_items
-- Tujuan: alur Generate Flashcard multi-materi (pilih materi -> pilih keyword -> job)
-- Prinsip: TANPA DROP/TUNCATE tabel lama. Hanya ALTER + index + perbaikan trigger.

-- ============================================================
-- 1. generation_jobs: kolom pendukung job idempoten + multi-dokumen
-- ============================================================
ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS deck_id uuid REFERENCES public.decks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind text
    CHECK (kind IS NULL OR kind IN ('material_upload','flashcard_generate','quiz_generate')),
  ADD COLUMN IF NOT EXISTS input jsonb,
  ADD COLUMN IF NOT EXISTS result jsonb,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Idempotency harus NOT NULL + UNIQUE penuh agar ON CONFLICT (user_id, idempotency_key)
-- bisa di-inference. Baris legacy di-backfill dulu.
UPDATE public.generation_jobs
SET idempotency_key = 'legacy:' || id::text
WHERE idempotency_key IS NULL;

ALTER TABLE public.generation_jobs
  ALTER COLUMN idempotency_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'generation_jobs_user_idempotency_key_key'
      AND conrelid = 'public.generation_jobs'::regclass
  ) THEN
    ALTER TABLE public.generation_jobs
      ADD CONSTRAINT generation_jobs_user_idempotency_key_key
      UNIQUE (user_id, idempotency_key);
  END IF;
END $$;

-- 2. document_id jadi nullable (job multi-materi tidak menempel 1 dokumen)
ALTER TABLE public.generation_jobs ALTER COLUMN document_id DROP NOT NULL;

-- 3. Perluas CHECK status: pertahankan nilai legacy + nilai alur baru
ALTER TABLE public.generation_jobs DROP CONSTRAINT IF EXISTS generation_jobs_status_check;
ALTER TABLE public.generation_jobs
  ADD CONSTRAINT generation_jobs_status_check
  CHECK (status IN ('queued','processing','running','completed','failed','succeeded','canceled'));

-- Index untuk claim job berjalan (sudah ada dari migration sebelumnya, pastikan ada)
CREATE INDEX IF NOT EXISTS generation_jobs_status_queued_running_idx
  ON public.generation_jobs (status)
  WHERE status IN ('queued','running','processing');

-- ============================================================
-- 2. generation_job_items: dukung item per (job, dokumen, keyword)
--    Tabel lama dipertahankan (PK id, batch_index, keyword_ids[] dipakai kode legacy).
-- ============================================================
ALTER TABLE public.generation_job_items
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS keyword_id uuid REFERENCES public.candidate_keywords(id) ON DELETE CASCADE;

-- chunk_id wajib di alur legacy; alur baru (per keyword) tidak punya chunk tunggal.
ALTER TABLE public.generation_job_items ALTER COLUMN chunk_id DROP NOT NULL;

-- Pengganti fungsi PK (job_id, keyword_id): unique index (legacy rows punya keyword_id NULL,
-- tidak ikut terdampak berkat predicate WHERE).
CREATE UNIQUE INDEX IF NOT EXISTS generation_job_items_job_keyword_unique
  ON public.generation_job_items (job_id, keyword_id)
  WHERE keyword_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS generation_job_items_document_id_idx
  ON public.generation_job_items (document_id);

ALTER TABLE public.generation_job_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. flashcards: deck_id + keyword_id, backfill, lalu UNIQUE (deck_id, keyword_id)
-- ============================================================
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS deck_id uuid REFERENCES public.decks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS keyword_id uuid REFERENCES public.candidate_keywords(id) ON DELETE SET NULL;

-- Backfill deck_id: deck pertama (added_at paling awal) yang menautkan dokumen tsb.
UPDATE public.flashcards f
SET deck_id = sub.deck_id
FROM (
  SELECT DISTINCT ON (document_id) document_id, deck_id
  FROM public.deck_documents
  ORDER BY document_id, added_at
) sub
WHERE f.deck_id IS NULL AND f.document_id = sub.document_id;

-- Backfill keyword_id: kecocokan istilah ternormalisasi dalam dokumen yang sama.
UPDATE public.flashcards f
SET keyword_id = k.id
FROM public.candidate_keywords k
WHERE f.keyword_id IS NULL
  AND k.document_id = f.document_id
  AND lower(btrim(k.term)) = lower(btrim(f.term));

-- Hitung duplikat (deck_id, keyword_id) SEBELUM index dibuat, tampilkan, lalu bersihkan
-- dengan aman (simpan baris id terkecil, hanya baris dengan kedua kolom terisi).
DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT deck_id, keyword_id, COUNT(*) AS cnt
    FROM public.flashcards
    WHERE deck_id IS NOT NULL AND keyword_id IS NOT NULL
    GROUP BY deck_id, keyword_id
    HAVING COUNT(*) > 1
  ) sub;

  RAISE NOTICE 'Duplikat flashcard (deck_id, keyword_id) ditemukan: %', duplicate_count;

  IF duplicate_count > 0 THEN
    DELETE FROM public.flashcards
    WHERE deck_id IS NOT NULL AND keyword_id IS NOT NULL
      AND id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY deck_id, keyword_id ORDER BY id
          ) AS rn
          FROM public.flashcards
          WHERE deck_id IS NOT NULL AND keyword_id IS NOT NULL
        ) ranked
        WHERE rn > 1
      );
    RAISE NOTICE 'Duplikat dihapus. Sisa flashcard: %', (SELECT COUNT(*) FROM public.flashcards);
  END IF;
END $$;

-- Ganti unique index lama -> UNIQUE (deck_id, keyword_id)
DROP INDEX IF EXISTS public.flashcards_document_term_unique;
CREATE UNIQUE INDEX IF NOT EXISTS flashcards_deck_keyword_unique
  ON public.flashcards (deck_id, keyword_id);

-- ============================================================
-- 4. Perbaiki trigger notify_job_change()
--    Versi sebelumnya mereferensikan NEW.error yang tidak ada di tabel
--    (kolomnya error_message) -> insert/update generation_jobs akan gagal runtime.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_job_change()
RETURNS TRIGGER AS $$
DECLARE
  job_id_val uuid := NEW.id;
  status_val text := NEW.status;
  user_id_val text := NEW.user_id;
  deck_id_val uuid := NEW.deck_id;
  doc_id_val uuid := NEW.document_id;
  error_val text := NEW.error_message;
  dedupe_val text;
  title_text text;
  body_text text;
  link_text text;
BEGIN
  link_text := CASE
    WHEN deck_id_val IS NOT NULL THEN '/desk/' || deck_id_val::text
    WHEN doc_id_val IS NOT NULL THEN '/desk/' || doc_id_val::text
    ELSE NULL
  END;

  title_text := CASE status_val
    WHEN 'queued' THEN 'Antrian: proses mulai ditunda'
    WHEN 'running' THEN 'Berjalan: proses sedang berlangsung'
    WHEN 'processing' THEN 'Berjalan: proses sedang berlangsung'
    WHEN 'succeeded' THEN 'Berhasil: flashcard selesai dibuat'
    WHEN 'completed' THEN 'Berhasil: flashcard selesai dibuat'
    WHEN 'failed' THEN 'Gagal: proses tidak dapat dilanjutkan'
    WHEN 'canceled' THEN 'Dibatalkan: proses dibatalkan'
    ELSE 'Perubahan status: ' || status_val
  END;

  body_text := CASE status_val
    WHEN 'failed' THEN COALESCE(error_val, 'Terjadi kesalahan tidak dikenal.')
    WHEN 'succeeded' THEN 'Proses berhasil diselesaikan.'
    WHEN 'completed' THEN 'Proses berhasil diselesaikan.'
    WHEN 'running' THEN 'Proses sedang berjalan, silakan tunggu.'
    WHEN 'processing' THEN 'Proses sedang berjalan, silakan tunggu.'
    WHEN 'queued' THEN 'Proses sedang dalam antrian.'
    WHEN 'canceled' THEN 'Proses telah dibatalkan.'
    ELSE NULL
  END;

  dedupe_val := job_id_val::text || ':' || status_val;

  INSERT INTO public.notifications (
    id, user_id, job_id, type, severity, title, body, link, dedupe_key, read_at, created_at
  ) VALUES (
    gen_random_uuid(), user_id_val, job_id_val, status_val,
    CASE
      WHEN status_val IN ('succeeded','completed') THEN 'success'
      WHEN status_val IN ('failed','canceled') THEN 'error'
      ELSE 'info'
    END,
    title_text, body_text, link_text, dedupe_val, NULL, NOW()
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_job_change_on_insert ON public.generation_jobs;
CREATE TRIGGER trigger_notify_job_change_on_insert
AFTER INSERT ON public.generation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.notify_job_change();

DROP TRIGGER IF EXISTS trigger_notify_job_change_on_status_update ON public.generation_jobs;
CREATE TRIGGER trigger_notify_job_change_on_status_update
AFTER UPDATE OF status ON public.generation_jobs
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_job_change();
