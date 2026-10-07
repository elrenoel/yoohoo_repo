-- Migration: advisor_fixes
-- Temuan advisors untuk tabel/alur baru:
-- 1. SECURITY: notify_job_change() (SECURITY DEFINER) tanpa SET search_path
-- 2. PERFORMANCE: FK baru tanpa index — generation_job_items.keyword_id,
--    flashcards.(deck_id|keyword_id|job_id), generation_jobs.deck_id

ALTER FUNCTION public.notify_job_change() SET search_path = '';

CREATE INDEX IF NOT EXISTS generation_job_items_keyword_id_idx
  ON public.generation_job_items (keyword_id);

CREATE INDEX IF NOT EXISTS generation_jobs_deck_id_idx
  ON public.generation_jobs (deck_id);

CREATE INDEX IF NOT EXISTS flashcards_deck_id_idx
  ON public.flashcards (deck_id);

CREATE INDEX IF NOT EXISTS flashcards_keyword_id_idx
  ON public.flashcards (keyword_id);

CREATE INDEX IF NOT EXISTS flashcards_job_id_idx
  ON public.flashcards (job_id);
