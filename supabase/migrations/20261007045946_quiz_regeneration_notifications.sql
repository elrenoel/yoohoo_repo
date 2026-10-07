-- Keep quiz-regeneration notifications synchronized with their generation job.
-- The job input stores the variant and the result stores the generated quiz set.
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
  quiz_variant text := coalesce(new.input ->> 'variant', 'different');
  quiz_set_id text := new.result ->> 'quizSetId';
  task_name text := case
    when new.kind = 'flashcard_generate' then 'flashcard dan quiz'
    when new.kind = 'quiz_generate' and quiz_variant = 'harder' then 'quiz lebih sulit'
    when new.kind = 'quiz_generate' then 'quiz dengan soal berbeda'
    when new.kind = 'material_upload' then 'materi'
    else 'task'
  end;
begin
  link_text := case
    when new.kind = 'quiz_generate' and new.document_id is not null and quiz_set_id is not null
      then '/desk/' || new.document_id::text || '/quiz?setId=' || quiz_set_id
    when new.deck_id is not null then '/desk/' || new.deck_id::text
    when new.document_id is not null then '/desk/' || new.document_id::text
    else '/desk'
  end;

  title_text := case new.status
    when 'queued' then 'Task masuk antrean'
    when 'running' then 'Sedang membuat ' || task_name
    when 'processing' then 'Sedang membuat ' || task_name
    when 'succeeded' then case
      when new.kind = 'quiz_generate' and quiz_variant = 'harder' then 'Quiz lebih sulit berhasil dibuat'
      when new.kind = 'quiz_generate' then 'Quiz dengan soal berbeda berhasil dibuat'
      else initcap(task_name) || ' berhasil dibuat'
    end
    when 'completed' then case
      when new.kind = 'quiz_generate' and quiz_variant = 'harder' then 'Quiz lebih sulit berhasil dibuat'
      when new.kind = 'quiz_generate' then 'Quiz dengan soal berbeda berhasil dibuat'
      else initcap(task_name) || ' berhasil dibuat'
    end
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
      when new.kind = 'quiz_generate' and quiz_variant = 'harder' then format('%s soal level sulit berhasil disimpan sebagai set baru.', new.quiz_count)
      when new.kind = 'quiz_generate' then format('%s soal berbeda berhasil disimpan sebagai set baru.', new.quiz_count)
      else 'Task berhasil diselesaikan.'
    end
    when 'completed' then case
      when new.kind = 'flashcard_generate' then format('%s flashcard dan %s soal quiz berhasil disimpan.', new.flashcard_count, new.quiz_count)
      when new.kind = 'quiz_generate' and quiz_variant = 'harder' then format('%s soal level sulit berhasil disimpan sebagai set baru.', new.quiz_count)
      when new.kind = 'quiz_generate' then format('%s soal berbeda berhasil disimpan sebagai set baru.', new.quiz_count)
      else 'Task berhasil diselesaikan.'
    end
    when 'failed' then coalesce(new.error_message, 'Task gagal diselesaikan.')
    when 'canceled' then 'Task dibatalkan sebelum selesai.'
    else null
  end;

  insert into public.notifications (
    user_id, job_id, type, severity, title, body, link, dedupe_key, read_at, created_at
  ) values (
    new.user_id,
    new.id,
    coalesce(new.kind, 'task') || ':' || new.status,
    case
      when new.status in ('succeeded', 'completed') then 'success'
      when new.status in ('failed', 'canceled') then 'error'
      else 'info'
    end,
    title_text,
    body_text,
    link_text,
    dedupe_val,
    null,
    now()
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

-- Refresh any quiz generation notifications recorded before this copy was added.
update public.notifications n
set
  type = 'quiz_generate:' || j.status,
  title = case
    when coalesce(j.input ->> 'variant', 'different') = 'harder' then 'Quiz lebih sulit berhasil dibuat'
    else 'Quiz dengan soal berbeda berhasil dibuat'
  end,
  body = case
    when coalesce(j.input ->> 'variant', 'different') = 'harder'
      then format('%s soal level sulit berhasil disimpan sebagai set baru.', j.quiz_count)
    else format('%s soal berbeda berhasil disimpan sebagai set baru.', j.quiz_count)
  end,
  link = case
    when j.document_id is not null and j.result ->> 'quizSetId' is not null
      then '/desk/' || j.document_id::text || '/quiz?setId=' || (j.result ->> 'quizSetId')
    else n.link
  end
from public.generation_jobs j
where n.job_id = j.id
  and j.kind = 'quiz_generate'
  and j.status in ('succeeded', 'completed');
