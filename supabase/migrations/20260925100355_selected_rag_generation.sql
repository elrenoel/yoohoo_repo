create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id text not null,
  selected_keyword_ids uuid[] not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  expected_items integer not null check (expected_items > 0),
  quota_count integer not null,
  remaining_quota integer not null,
  flashcard_count integer not null default 0,
  quiz_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table public.generation_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  chunk_id uuid not null references public.document_chunks(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  flashcards jsonb,
  questions jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, chunk_id),
  check (flashcards is null or jsonb_typeof(flashcards) = 'array'),
  check (questions is null or jsonb_typeof(questions) = 'array')
);

create unique index generation_jobs_one_active_per_document
  on public.generation_jobs(document_id) where status in ('queued', 'processing');
create index generation_jobs_user_created_idx on public.generation_jobs(user_id, created_at desc);
create index generation_job_items_job_status_idx on public.generation_job_items(job_id, status);

alter table public.generation_jobs enable row level security;
alter table public.generation_job_items enable row level security;
revoke all on public.generation_jobs, public.generation_job_items from public, anon, authenticated;
grant select, insert, update, delete on public.generation_jobs, public.generation_job_items to service_role;

create or replace function private.start_selected_content_generation(
  p_user_id text,
  p_document_id uuid,
  p_daily_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_document public.documents%rowtype;
  v_job public.generation_jobs%rowtype;
  v_keyword_ids uuid[];
  v_keyword_count integer;
  v_chunk_count integer;
  v_quota record;
begin
  select * into v_document
  from public.documents
  where id = p_document_id and user_id = p_user_id and deleted_at is null
  for update;

  if not found then raise exception 'DOCUMENT_NOT_FOUND'; end if;
  if v_document.status <> 'ready_for_selection' then raise exception 'DOCUMENT_NOT_READY'; end if;

  select array_agg(k.id order by k.id), count(*)::integer,
         count(distinct k.chunk_id)::integer
    into v_keyword_ids, v_keyword_count, v_chunk_count
  from public.candidate_keywords k
  where k.document_id = p_document_id and k.is_selected is true;

  if coalesce(v_keyword_count, 0) = 0 then raise exception 'NO_KEYWORDS_SELECTED'; end if;
  if exists (
    select 1 from public.candidate_keywords k
    where k.document_id = p_document_id and k.is_selected is true
      and (k.chunk_id is null or not exists (
        select 1 from public.document_chunks c
        where c.id = k.chunk_id and c.document_id = p_document_id
      ))
  ) then raise exception 'SELECTED_KEYWORD_MISSING_CHUNK'; end if;

  select * into v_job
  from public.generation_jobs
  where document_id = p_document_id and status in ('queued', 'processing')
  order by created_at desc limit 1;

  if found then
    if v_job.selected_keyword_ids <> v_keyword_ids then raise exception 'GENERATION_IN_PROGRESS'; end if;
    return jsonb_build_object('id', v_job.id, 'status', v_job.status,
      'remaining_quota', v_job.remaining_quota, 'created', false);
  end if;

  select * into v_job
  from public.generation_jobs
  where document_id = p_document_id and status = 'completed'
    and selected_keyword_ids = v_keyword_ids
  order by created_at desc limit 1;

  if found then
    return jsonb_build_object('id', v_job.id, 'status', v_job.status,
      'remaining_quota', v_job.remaining_quota, 'created', false);
  end if;

  select * into v_quota from public.consume_generation_quota(p_user_id, p_daily_limit);

  insert into public.generation_jobs (
    document_id, user_id, selected_keyword_ids, expected_items, quota_count, remaining_quota
  ) values (
    p_document_id, p_user_id, v_keyword_ids, v_chunk_count, v_quota.new_count, v_quota.remaining
  ) returning * into v_job;

  insert into public.generation_job_items(job_id, chunk_id)
  select v_job.id, k.chunk_id
  from public.candidate_keywords k
  where k.document_id = p_document_id and k.is_selected is true
  group by k.chunk_id;

  return jsonb_build_object('id', v_job.id, 'status', v_job.status,
    'remaining_quota', v_job.remaining_quota, 'created', true);
end;
$$;

create or replace function private.complete_selected_content_generation(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_job public.generation_jobs%rowtype;
  v_completed integer;
  v_failed integer;
  v_flashcard_count integer;
  v_quiz_count integer;
  v_set_id uuid;
begin
  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found then raise exception 'GENERATION_JOB_NOT_FOUND'; end if;
  if v_job.status = 'completed' then
    return jsonb_build_object('flashcard_count', v_job.flashcard_count, 'quiz_count', v_job.quiz_count);
  end if;
  if v_job.status = 'failed' then raise exception 'GENERATION_JOB_FAILED'; end if;

  select count(*) filter (where status = 'completed')::integer,
         count(*) filter (where status = 'failed')::integer
    into v_completed, v_failed
  from public.generation_job_items where job_id = p_job_id;

  if v_failed > 0 then raise exception 'GENERATION_ITEM_FAILED'; end if;
  if v_completed <> v_job.expected_items then raise exception 'GENERATION_ITEMS_INCOMPLETE'; end if;

  delete from public.flashcards where document_id = v_job.document_id;
  insert into public.flashcards(document_id, term, definition)
  select v_job.document_id, x.term, x.definition
  from public.generation_job_items i
  cross join lateral jsonb_to_recordset(i.flashcards) as x(term text, definition text)
  where i.job_id = p_job_id;
  get diagnostics v_flashcard_count = row_count;

  select id into v_set_id from public.quiz_sets
  where document_id = v_job.document_id order by created_at limit 1;
  if v_set_id is null then
    insert into public.quiz_sets(document_id, label) values (v_job.document_id, 'Set 1') returning id into v_set_id;
  end if;
  delete from public.quiz_questions where quiz_set_id = v_set_id;
  insert into public.quiz_questions(document_id, quiz_set_id, question, options, correct_index)
  select v_job.document_id, v_set_id, x.question, x.options, x.correct_index
  from public.generation_job_items i
  cross join lateral jsonb_to_recordset(i.questions)
    as x(question text, options jsonb, correct_index integer)
  where i.job_id = p_job_id;
  get diagnostics v_quiz_count = row_count;

  if v_flashcard_count = 0 or v_quiz_count = 0 then raise exception 'GENERATED_CONTENT_EMPTY'; end if;

  update public.generation_jobs set status = 'completed', flashcard_count = v_flashcard_count,
    quiz_count = v_quiz_count, error_message = null, completed_at = now()
  where id = p_job_id;

  return jsonb_build_object('flashcard_count', v_flashcard_count, 'quiz_count', v_quiz_count);
end;
$$;

revoke all on function private.start_selected_content_generation(text, uuid, integer) from public, anon, authenticated;
revoke all on function private.complete_selected_content_generation(uuid) from public, anon, authenticated;
grant execute on function private.start_selected_content_generation(text, uuid, integer) to service_role;
grant execute on function private.complete_selected_content_generation(uuid) to service_role;
