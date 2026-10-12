-- English is the default product language. Preserve user-authored names while
-- translating system-generated notification copy and default group labels.

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
    when new.kind = 'flashcard_generate' then 'flashcards and quiz'
    when new.kind = 'quiz_generate' and quiz_variant = 'harder' then 'harder quiz'
    when new.kind = 'quiz_generate' then 'quiz with different questions'
    when new.kind = 'material_upload' then 'material'
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
    when 'queued' then 'Task queued'
    when 'running' then 'Creating ' || task_name
    when 'processing' then 'Creating ' || task_name
    when 'succeeded' then case
      when new.kind = 'quiz_generate' and quiz_variant = 'harder' then 'Harder quiz created'
      when new.kind = 'quiz_generate' then 'Quiz with different questions created'
      else initcap(task_name) || ' created'
    end
    when 'completed' then case
      when new.kind = 'quiz_generate' and quiz_variant = 'harder' then 'Harder quiz created'
      when new.kind = 'quiz_generate' then 'Quiz with different questions created'
      else initcap(task_name) || ' created'
    end
    when 'failed' then 'Could not create ' || task_name
    when 'canceled' then initcap(task_name) || ' creation canceled'
    else 'Task status updated'
  end;

  body_text := case new.status
    when 'queued' then 'This task is waiting to be processed.'
    when 'running' then 'This task is being processed. The result will appear automatically when it is ready.'
    when 'processing' then 'This task is being processed. The result will appear automatically when it is ready.'
    when 'succeeded' then case
      when new.kind = 'flashcard_generate' then format('%s flashcards and %s quiz questions saved.', new.flashcard_count, new.quiz_count)
      when new.kind = 'quiz_generate' and quiz_variant = 'harder' then format('%s harder questions saved as a new set.', new.quiz_count)
      when new.kind = 'quiz_generate' then format('%s different questions saved as a new set.', new.quiz_count)
      else 'Task completed successfully.'
    end
    when 'completed' then case
      when new.kind = 'flashcard_generate' then format('%s flashcards and %s quiz questions saved.', new.flashcard_count, new.quiz_count)
      when new.kind = 'quiz_generate' and quiz_variant = 'harder' then format('%s harder questions saved as a new set.', new.quiz_count)
      when new.kind = 'quiz_generate' then format('%s different questions saved as a new set.', new.quiz_count)
      else 'Task completed successfully.'
    end
    when 'failed' then coalesce(new.error_message, 'The task could not be completed.')
    when 'canceled' then 'The task was canceled before completion.'
    else null
  end;

  insert into public.notifications (
    user_id, job_id, type, severity, title, body, link, dedupe_key, read_at, created_at
  ) values (
    new.user_id, new.id, coalesce(new.kind, 'task') || ':' || new.status,
    case when new.status in ('succeeded', 'completed') then 'success'
         when new.status in ('failed', 'canceled') then 'error' else 'info' end,
    title_text, body_text, link_text, dedupe_val, null, now()
  )
  on conflict (dedupe_key) do update set
    type = excluded.type, severity = excluded.severity, title = excluded.title,
    body = excluded.body, link = excluded.link;
  return new;
end;
$$;

revoke all on function public.notify_job_change() from public, anon, authenticated;

update public.notifications set
  title = case type
    when 'profile_created' then 'Profile created'
    when 'profile_updated' then 'Profile updated'
    when 'deck_created' then 'Deck created'
    when 'upload_started' then 'Material upload received'
    when 'upload_succeeded' then 'Material processing complete'
    when 'upload_failed' then 'Material upload failed'
    when 'deck_deleted' then 'Deck moved to Trash'
    when 'deck_restored' then 'Deck restored'
    when 'deck_deleted_permanently' then 'Deck permanently deleted'
    when 'post_published' then 'Post published'
    when 'deck_visibility_changed' then case when title ilike '%private%' then 'Deck is private' else 'Deck shared' end
    when 'deck_forked' then 'Deck added to Your Desk'
    when 'fork' then 'Someone copied your deck'
    when 'like' then 'Someone liked your content'
    when 'comment' then 'New comment'
    when 'reply' then 'New reply'
    when 'quiz_generate:succeeded' then 'Quiz with different questions created'
    when 'flashcard_generate:succeeded' then 'Flashcards and quiz created'
    else title
  end,
  body = regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(body,
                    '^Perubahan profil (@[^ ]+) telah disimpan\.$', 'Changes to \1 have been saved.'),
                  '^Profil (@[^ ]+) siap digunakan\.$', 'Your \1 profile is ready.'),
                '^Deck "(.*)" siap digunakan\.$', 'Deck "\1" is ready to use.'),
              '^Materi "(.*)" sedang diproses untuk mengekstrak keyword\.$', 'Material "\1" is being processed to extract keywords.'),
            '^Deck "(.*)" dapat dipulihkan selama 30 hari\.$', 'Deck "\1" can be restored within 30 days.'),
          '^Deck "(.*)" telah dihapus permanen\.$', 'Deck "\1" was permanently deleted.'),
        '^Post baru kamu sudah tampil di feed\.$', 'Your new post is now visible in the feed.'),
      '([0-9]+) flashcard dan ([0-9]+) soal quiz berhasil disimpan\.', '\1 flashcards and \2 quiz questions saved.'),
    '([0-9]+) soal berbeda berhasil disimpan sebagai set baru\.', '\1 different questions saved as a new set.')
where title ~* '(berhasil|gagal|sampah|materi|dibuat|diperbarui|dipindahkan|publik|dibagikan|di-fork|disukai|komentar|balasan)'
   or body ~* '(berhasil|gagal|sampah|materi|dibuat|diperbarui|dipindahkan|kamu|sedang|siap|publik|disimpan)';

update public.notifications
set title = regexp_replace(title, ' mulai mengikuti kamu$', ' started following you'),
    body = regexp_replace(body, '^(@[^ ]+) sekarang mengikuti profilmu\.$', '\1 now follows your profile.')
where type = 'new_follower';

update public.notifications
set title = replace(replace(replace(title, ' menyimpan ', ' saved your '), ' me-repost ', ' reposted your '), ' kamu', ''),
    body = replace(replace(replace(body, ' menyimpan ', ' saved your '), ' me-repost ', ' reposted your '), ' kamu', '')
where type in ('save', 'repost');

update public.flashcard_groups
set name = regexp_replace(name, '^Kartu ([0-9]+)$', 'Cards \1')
where name ~ '^Kartu [0-9]+$';
