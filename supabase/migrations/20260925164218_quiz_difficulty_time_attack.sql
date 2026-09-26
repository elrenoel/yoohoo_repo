alter table public.quiz_questions
  add column if not exists difficulty text not null default 'medium'
  check (difficulty in ('easy', 'medium', 'hard'));

alter table public.quiz_attempts
  add column if not exists mode text not null default 'normal'
  check (mode in ('normal', 'time_attack')),
  add column if not exists total_time_ms integer;

create table if not exists public.quiz_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id),
  selected_index integer,
  is_correct boolean not null,
  time_taken_ms integer,
  status text not null check (status in ('answered', 'skipped', 'timeout')),
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempt_answers_attempt_idx
  on public.quiz_attempt_answers (attempt_id);
create unique index if not exists quiz_attempt_answers_attempt_question_idx
  on public.quiz_attempt_answers (attempt_id, question_id);

alter table public.quiz_attempt_answers enable row level security;
revoke all on public.quiz_attempt_answers from public, anon, authenticated;
grant select, insert, update, delete on public.quiz_attempt_answers to service_role;

create or replace function private.complete_selected_content_generation(
  p_job_id uuid,
  p_questions jsonb
) returns jsonb
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
  v_expected_quiz_count integer;
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

  v_expected_quiz_count := greatest(5, least(20, round(cardinality(v_job.selected_keyword_ids) / 3.0)::integer));
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) <> v_expected_quiz_count then
    raise exception 'INVALID_QUIZ_COUNT';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_questions) as x(question text, options jsonb, correct_index integer, explanation text, difficulty text)
    where length(trim(coalesce(x.question, ''))) < 6 or jsonb_typeof(x.options) <> 'array'
      or jsonb_array_length(x.options) <> 4 or x.correct_index not between 0 and 3
      or length(trim(coalesce(x.explanation, ''))) < 4
      or x.difficulty not in ('easy', 'medium', 'hard')
  ) then raise exception 'INVALID_QUIZ_PAYLOAD'; end if;

  delete from public.flashcards where document_id = v_job.document_id;
  insert into public.flashcards(document_id, term, definition)
  select v_job.document_id, x.term, x.definition
  from public.generation_job_items i
  cross join lateral jsonb_to_recordset(i.flashcards) as x(term text, definition text)
  where i.job_id = p_job_id;
  get diagnostics v_flashcard_count = row_count;
  if v_flashcard_count = 0 then raise exception 'GENERATED_CONTENT_EMPTY'; end if;

  select id into v_set_id from public.quiz_sets where document_id = v_job.document_id order by created_at limit 1;
  if v_set_id is null then
    insert into public.quiz_sets(document_id, label) values (v_job.document_id, 'Set 1') returning id into v_set_id;
  end if;
  delete from public.quiz_questions where quiz_set_id = v_set_id;
  insert into public.quiz_questions(document_id, quiz_set_id, question, options, correct_index, explanation, difficulty)
  select v_job.document_id, v_set_id, x.question, x.options, x.correct_index, x.explanation, x.difficulty
  from jsonb_to_recordset(p_questions) as x(question text, options jsonb, correct_index integer, explanation text, difficulty text);
  get diagnostics v_quiz_count = row_count;
  if v_quiz_count <> v_expected_quiz_count then raise exception 'GENERATED_CONTENT_EMPTY'; end if;
  update public.generation_jobs set status = 'completed', flashcard_count = v_flashcard_count, quiz_count = v_quiz_count,
    error_message = null, completed_at = now() where id = p_job_id;
  return jsonb_build_object('flashcard_count', v_flashcard_count, 'quiz_count', v_quiz_count);
end;
$$;

revoke all on function private.complete_selected_content_generation(uuid, jsonb) from public, anon, authenticated;
grant execute on function private.complete_selected_content_generation(uuid, jsonb) to service_role;
