-- Keep notification copy synchronized with the generation job that produced it.
-- The function is trigger-only: revoke direct execution and use an empty search_path.
create or replace function public.notify_job_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  title_text text;
  body_text text;
  link_text text;
  dedupe_val text := new.id::text || ':' || new.status;
  task_name text := case new.kind
    when 'flashcard_generate' then 'flashcard dan quiz'
    when 'quiz_generate' then 'quiz'
    when 'material_upload' then 'materi'
    else 'task'
  end;
begin
  link_text := case
    when new.deck_id is not null then '/desk/' || new.deck_id::text
    when new.document_id is not null then '/desk/' || new.document_id::text
    else '/desk'
  end;

  title_text := case new.status
    when 'queued' then 'Task masuk antrean'
    when 'running' then 'Sedang membuat ' || task_name
    when 'processing' then 'Sedang membuat ' || task_name
    when 'succeeded' then initcap(task_name) || ' berhasil dibuat'
    when 'completed' then initcap(task_name) || ' berhasil dibuat'
    when 'failed' then 'Pembuatan ' || task_name || ' gagal'
    when 'canceled' then 'Pembuatan ' || task_name || ' dibatalkan'
    else 'Status task diperbarui'
  end;

  body_text := case new.status
    when 'queued' then 'Task menunggu giliran untuk diproses.'
    when 'running' then 'Task sedang diproses. Hasil akan muncul otomatis setelah selesai.'
    when 'processing' then 'Task sedang diproses. Hasil akan muncul otomatis setelah selesai.'
    when 'succeeded' then case
      when new.kind = 'flashcard_generate' then format('%s flashcard dan %s soal quiz berhasil disimpan.', new.flashcard_count, new.quiz_count)
      else 'Task berhasil diselesaikan.'
    end
    when 'completed' then case
      when new.kind = 'flashcard_generate' then format('%s flashcard dan %s soal quiz berhasil disimpan.', new.flashcard_count, new.quiz_count)
      else 'Task berhasil diselesaikan.'
    end
    when 'failed' then coalesce(new.error_message, 'Task gagal diselesaikan.')
    when 'canceled' then 'Task dibatalkan sebelum selesai.'
    else null
  end;

  insert into public.notifications (
    user_id, job_id, type, severity, title, body, link, dedupe_key, read_at, created_at
  ) values (
    new.user_id, new.id, coalesce(new.kind, 'task') || ':' || new.status,
    case
      when new.status in ('succeeded', 'completed') then 'success'
      when new.status in ('failed', 'canceled') then 'error'
      else 'info'
    end,
    title_text, body_text, link_text, dedupe_val, null, now()
  )
  on conflict (dedupe_key) do update set
    type = excluded.type,
    severity = excluded.severity,
    title = excluded.title,
    body = excluded.body,
    link = excluded.link;

  return new;
end;
$$;

revoke all on function public.notify_job_change() from public, anon, authenticated;

-- Existing rows were created before job-aware copy was available. Refresh their
-- user-facing text without changing read state or creating duplicate events.
update public.notifications n
set
  type = coalesce(j.kind, 'task') || ':' || j.status,
  title = case j.status
    when 'queued' then 'Task masuk antrean'
    when 'running' then 'Sedang membuat flashcard dan quiz'
    when 'succeeded' then 'Flashcard dan quiz berhasil dibuat'
    when 'failed' then 'Pembuatan flashcard dan quiz gagal'
    else n.title
  end,
  body = case
    when j.status = 'succeeded' and j.kind = 'flashcard_generate'
      then format('%s flashcard dan %s soal quiz berhasil disimpan.', j.flashcard_count, j.quiz_count)
    when j.status = 'failed' then coalesce(j.error_message, n.body)
    else n.body
  end
from public.generation_jobs j
where n.job_id = j.id;
