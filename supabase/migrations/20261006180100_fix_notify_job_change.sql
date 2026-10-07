-- Migration: fix_notify_job_change
-- Migration 20261006180000 membuat fungsi notify_job_change() dengan variabel
-- `dedupe_key` yang ambigu dengan kolom target INSERT -> runtime error
-- "column reference dedupe_key is ambiguous" pada setiap INSERT/UPDATE status
-- generation_jobs. Perbaiki dengan nama variabel berbeda (dedupe_val).
-- CREATE OR REPLACE mempertahankan OID, sehingga trigger yang sudah ada tetap valid.

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
