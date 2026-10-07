-- Migration: add_generation_jobs_and_notifications
-- Tujuan: Menambahkan sistem ACID jobs dan notifikasi untuk materi, flashcard, dan quiz

-- 1. Tambahkan kolom job_id ke flashcards (jika belum ada)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'flashcards' AND column_name = 'job_id'
  ) THEN
    ALTER TABLE public.flashcards 
    ADD COLUMN job_id uuid REFERENCES public.generation_jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Tambahkan kolom job_id ke quizzes (jika belum ada)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quiz_sets' AND column_name = 'job_id'
  ) THEN
    ALTER TABLE public.quiz_sets 
    ADD COLUMN job_id uuid REFERENCES public.generation_jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Buat index untuk mencegah duplikat flashcard per (document_id, keyword_id)
-- Bersihkan data duplikat terlebih dahulu
DO $$
DECLARE
  duplicate_count integer;
BEGIN
  -- Hitung duplikat
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT document_id, term, COUNT(*) as cnt
    FROM public.flashcards
    GROUP BY document_id, term
    HAVING COUNT(*) > 1
  ) sub;
  
  RAISE NOTICE 'Jumlah duplikat flashcard yang akan dihapus: %', duplicate_count;
  
  -- Hapus duplikat (simpan yang paling baru)
  DELETE FROM public.flashcards
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY document_id, term ORDER BY created_at DESC) as rn
      FROM public.flashcards
    ) t
    WHERE rn > 1
  );
  
  RAISE NOTICE 'Duplikat dihapus. Sisa flashcard: %', (SELECT COUNT(*) FROM public.flashcards);
END $$;

-- 4. Buat unique index pencegah duplikat flashcard per (document_id, term)
CREATE UNIQUE INDEX IF NOT EXISTS flashcards_document_term_unique 
ON public.flashcards (document_id, term)
WHERE term IS NOT NULL;

-- 5. Buat fungsi notify_job_change() untuk insert notifikasi otomatis
CREATE OR REPLACE FUNCTION public.notify_job_change()
RETURNS TRIGGER AS $$
DECLARE
  job_id_val uuid;
  status_val text;
  user_id_val text;
  deck_id_val uuid;
  doc_id_val uuid;
  error_val text;
  dedupe_key text;
  title_text text;
  body_text text;
  link_text text;
BEGIN
  -- Ambil nilai dari NEW row
  job_id_val := NEW.id;
  status_val := NEW.status;
  user_id_val := NEW.user_id;
  deck_id_val := NEW.deck_id;
  doc_id_val := NEW.document_id;
  error_val := NEW.error;
  
  -- Tentukan link ke /desk/:deck_id bila ada
  link_text := CASE 
    WHEN deck_id_val IS NOT NULL THEN '/desk/' || deck_id_val::text
    ELSE NULL
  END;
  
  -- Tentukan judul dalam Bahasa Indonesia sesuai status
  title_text := CASE status_val
    WHEN 'queued' THEN 'Antrian: proses mulai ditunda'
    WHEN 'running' THEN 'Berjalan: proses sedang berlangsung'
    WHEN 'succeeded' THEN 'Berhasil: proses selesai dibuat'
    WHEN 'failed' THEN 'Gagal: proses tidak dapat dilanjutkan'
    WHEN 'canceled' THEN 'Dibatalkan: proses dibatalkan'
    ELSE 'Perubahan status: ' || status_val
  END;
  
  -- Tentukan body sesuai status
  body_text := CASE status_val
    WHEN 'failed' THEN COALESCE(error_val, 'Terjadi kesalahan tidak dikenal.')
    WHEN 'succeeded' THEN 'Proses berhasil diselesaikan.'
    WHEN 'running' THEN 'Proses sedang berjalan, silakan tunggu.'
    WHEN 'queued' THEN 'Proses sedang dalam antrian.'
    WHEN 'canceled' THEN 'Proses telah dibatalkan.'
    ELSE NULL
  END;
  
  -- Buat dedupe_key: job_id || ':' || status
  dedupe_key := job_id_val::text || ':' || status_val;
  
  -- Insert ke notifications dengan ON CONFLICT DO NOTHING
  INSERT INTO public.notifications (
    id, user_id, job_id, type, severity, title, body, link, dedupe_key, read_at, created_at
  ) VALUES (
    gen_random_uuid(),
    user_id_val,
    job_id_val,
    status_val,
    CASE 
      WHEN status_val IN ('succeeded') THEN 'success'
      WHEN status_val IN ('failed', 'canceled') THEN 'error'
      ELSE 'info'
    END,
    title_text,
    body_text,
    link_text,
    dedupe_key,
    NULL,
    NOW()
  )
  ON CONFLICT (dedupe_key) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Buat trigger AFTER INSERT pada generation_jobs
DROP TRIGGER IF EXISTS trigger_notify_job_change_on_insert ON public.generation_jobs;
CREATE TRIGGER trigger_notify_job_change_on_insert
AFTER INSERT ON public.generation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.notify_job_change();

-- 7. Buat trigger AFTER UPDATE OF status pada generation_jobs
DROP TRIGGER IF EXISTS trigger_notify_job_change_on_status_update ON public.generation_jobs;
CREATE TRIGGER trigger_notify_job_change_on_status_update
AFTER UPDATE OF status ON public.generation_jobs
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_job_change();

-- 8. Aktifkan RLS pada generation_jobs (tanpa policy - hanya untuk menutup akses PostgREST/anon)
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

-- 9. Aktifkan RLS pada notifications (tanpa policy)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 10. Buat index (user_id, created_at DESC) pada notifications
CREATE INDEX IF NOT EXISTS notifications_user_created_idx 
ON public.notifications (user_id, created_at DESC);

-- 11. Buat partial index (user_id) WHERE read_at IS NULL
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx 
ON public.notifications (user_id) 
WHERE read_at IS NULL;

-- 12. Pastikan index pada generation_jobs sudah ada
CREATE INDEX IF NOT EXISTS generation_jobs_user_created_idx 
ON public.generation_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS generation_jobs_status_queued_running_idx 
ON public.generation_jobs (status) 
WHERE status IN ('queued', 'running');

-- 13. Tambahkan index FK untuk generation_jobs references
CREATE INDEX IF NOT EXISTS generation_jobs_deck_id_idx 
ON public.generation_jobs (deck_id);

CREATE INDEX IF NOT EXISTS generation_jobs_document_id_idx 
ON public.generation_jobs (document_id);

-- 14. Tambahkan index FK untuk notifications job_id
CREATE INDEX IF NOT EXISTS notifications_job_id_idx 
ON public.notifications (job_id);

-- 15. Pastikan fungsi search_path yang aman
SET search_path TO public, pg_temp;

-- Selesai migration
