-- Harden the existing queued/running/succeeded/failed flashcard generation flow.
-- Existing rows are preserved; old flashcards intentionally keep NULL blob_variant.

create unique index if not exists uq_generation_jobs_active_per_deck
  on public.generation_jobs (deck_id)
  where status in ('queued','running');

alter table public.flashcards add column if not exists blob_variant smallint;
alter table public.flashcards alter column blob_variant drop default;
alter table public.flashcards alter column blob_variant drop not null;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.flashcards'::regclass and conname='flashcards_blob_variant_check'
  ) then
    alter table public.flashcards add constraint flashcards_blob_variant_check
      check (blob_variant between 1 and 5);
  end if;
end $$;

alter table public.generation_quota_events
  add column if not exists deck_id uuid,
  add column if not exists job_id uuid,
  add column if not exists refunded_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.generation_quota_events'::regclass and conname='generation_quota_events_deck_id_fkey') then
    alter table public.generation_quota_events add constraint generation_quota_events_deck_id_fkey foreign key(deck_id) references public.decks(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.generation_quota_events'::regclass and conname='generation_quota_events_job_id_fkey') then
    alter table public.generation_quota_events add constraint generation_quota_events_job_id_fkey foreign key(job_id) references public.generation_jobs(id) on delete set null;
  end if;
end $$;
create index if not exists generation_quota_events_job_id_idx on public.generation_quota_events(job_id);
create index if not exists generation_quota_events_deck_id_idx on public.generation_quota_events(deck_id);

alter table public.generation_quota_events drop constraint if exists generation_quota_events_kind_check;
alter table public.generation_quota_events add constraint generation_quota_events_kind_check
  check(kind in ('document_pipeline','quiz_extra','flashcard_generate'));

create or replace function private.consume_generation_quota_event(
  p_user_id text,p_event_key text,p_kind text,p_daily_limit integer,p_document_id uuid default null
) returns table(event_id uuid,new_count integer,remaining integer,created boolean,document_id uuid,quiz_set_id uuid)
language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_existing public.generation_quota_events%rowtype; v_quota record;
begin
  if nullif(trim(p_event_key),'') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_kind not in ('document_pipeline','quiz_extra','flashcard_generate') then raise exception 'INVALID_QUOTA_EVENT_KIND'; end if;
  select * into v_existing from public.generation_quota_events where user_id=p_user_id and event_key=p_event_key for update;
  if found then
    if v_existing.kind<>p_kind then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return query select v_existing.id,v_existing.quota_count,v_existing.remaining_quota,false,v_existing.document_id,v_existing.quiz_set_id;
    return;
  end if;
  select * into v_quota from public.consume_generation_quota(p_user_id,p_daily_limit);
  insert into public.generation_quota_events(user_id,event_key,kind,document_id,quota_count,remaining_quota,quota_date)
  values(p_user_id,p_event_key,p_kind,p_document_id,v_quota.new_count,v_quota.remaining,v_quota.quota_date)
  returning * into v_existing;
  return query select v_existing.id,v_existing.quota_count,v_existing.remaining_quota,true,v_existing.document_id,v_existing.quiz_set_id;
end $$;

create or replace function private.refund_generation_quota_event(p_user_id text,p_event_key text)
returns boolean language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_event public.generation_quota_events%rowtype; v_today date:=(now() at time zone 'utc')::date;
begin
  select * into v_event from public.generation_quota_events where user_id=p_user_id and event_key=p_event_key for update;
  if not found or v_event.refunded_at is not null then return false; end if;
  if v_event.quota_date=v_today then
    update public."user" set generation_count_today=greatest(0,coalesce(generation_count_today,0)-1),updated_at=now()
    where id=p_user_id and last_generation_date::date=v_today;
  end if;
  update public.generation_quota_events set refunded_at=now() where id=v_event.id;
  return true;
end $$;

revoke all on function private.consume_generation_quota_event(text,text,text,integer,uuid) from public,anon,authenticated;
revoke all on function private.refund_generation_quota_event(text,text) from public,anon,authenticated;

create or replace function public.notify_job_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  title_text text; body_text text; link_text text;
  dedupe_val text:=new.id::text||':'||new.status;
  quiz_variant text:=coalesce(new.input->>'variant','different');
  quiz_set_id text:=new.result->>'quizSetId';
  task_name text:=case when new.kind='flashcard_generate' then 'flashcards and quiz' when new.kind='quiz_generate' and quiz_variant='harder' then 'harder quiz' when new.kind='quiz_generate' then 'quiz with different questions' when new.kind='material_upload' then 'material' else 'task' end;
begin
  link_text:=case when new.kind='quiz_generate' and new.document_id is not null and quiz_set_id is not null then '/desk/'||new.document_id::text||'/quiz?setId='||quiz_set_id when new.deck_id is not null then '/desk/'||new.deck_id::text when new.document_id is not null then '/desk/'||new.document_id::text else '/desk' end;
  title_text:=case new.status when 'queued' then 'Task queued' when 'running' then 'Creating '||task_name when 'processing' then 'Creating '||task_name when 'succeeded' then case when new.kind='quiz_generate' and quiz_variant='harder' then 'Harder quiz created' when new.kind='quiz_generate' then 'Quiz with different questions created' else initcap(task_name)||' created' end when 'completed' then initcap(task_name)||' created' when 'failed' then 'Could not create '||task_name when 'canceled' then initcap(task_name)||' creation canceled' else 'Task status updated' end;
  body_text:=case new.status when 'queued' then 'This task is waiting to be processed.' when 'running' then 'This task is being processed. The result will appear automatically when it is ready.' when 'processing' then 'This task is being processed. The result will appear automatically when it is ready.' when 'succeeded' then case when new.kind='flashcard_generate' then format('%s flashcards and %s quiz questions saved.',new.flashcard_count,new.quiz_count) when new.kind='quiz_generate' and quiz_variant='harder' then format('%s harder questions saved as a new set.',new.quiz_count) when new.kind='quiz_generate' then format('%s different questions saved as a new set.',new.quiz_count) else 'Task completed successfully.' end when 'completed' then 'Task completed successfully.' when 'failed' then coalesce(new.error_message,'The task could not be completed.') when 'canceled' then 'The task was canceled before completion.' else null end;
  insert into public.notifications(user_id,job_id,type,severity,title,body,link,dedupe_key,read_at,created_at)
  values(new.user_id,new.id,
    case when new.kind='flashcard_generate' and new.status in ('succeeded','completed') then 'flashcard_generated' when new.kind='flashcard_generate' and new.status='failed' then 'flashcard_generate_failed' else coalesce(new.kind,'task')||':'||new.status end,
    case when new.status in ('succeeded','completed') then 'success' when new.status in ('failed','canceled') then 'error' else 'info' end,
    title_text,body_text,link_text,dedupe_val,null,now())
  on conflict(dedupe_key) do update set type=excluded.type,severity=excluded.severity,title=excluded.title,body=excluded.body,link=excluded.link;
  return new;
end $$;

revoke all on function public.notify_job_change() from public,anon,authenticated;
