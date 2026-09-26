-- Unified, idempotent daily quota events (UTC).  The application uses the
-- service-role connection; the table and functions are intentionally private.
create table if not exists public.generation_quota_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public."user"(id) on delete cascade,
  event_key text not null,
  kind text not null check (kind in ('document_pipeline','quiz_extra')),
  document_id uuid references public.documents(id) on delete cascade,
  quiz_set_id uuid references public.quiz_sets(id) on delete set null,
  quota_count integer not null,
  remaining_quota integer not null,
  quota_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);
create index if not exists generation_quota_events_user_created_idx
  on public.generation_quota_events(user_id, created_at desc);
create index if not exists generation_quota_events_document_idx
  on public.generation_quota_events(document_id);
alter table public.generation_quota_events enable row level security;
revoke all on public.generation_quota_events from public, anon, authenticated;
grant select, insert, update on public.generation_quota_events to service_role;

create or replace function private.consume_generation_quota_event(
  p_user_id text, p_event_key text, p_kind text, p_daily_limit integer,
  p_document_id uuid default null
) returns table(event_id uuid, new_count integer, remaining integer,
  created boolean, document_id uuid, quiz_set_id uuid)
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare v_existing public.generation_quota_events%rowtype; v_quota record;
begin
  if nullif(trim(p_event_key),'') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_kind not in ('document_pipeline','quiz_extra') then raise exception 'INVALID_QUOTA_EVENT_KIND'; end if;
  select * into v_existing from public.generation_quota_events
    where user_id=p_user_id and event_key=p_event_key for update;
  if found then
    if v_existing.kind <> p_kind then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return query select v_existing.id,v_existing.quota_count,v_existing.remaining_quota,
      false,v_existing.document_id,v_existing.quiz_set_id; return;
  end if;
  select * into v_quota from public.consume_generation_quota(p_user_id,p_daily_limit);
  insert into public.generation_quota_events(user_id,event_key,kind,document_id,
    quota_count,remaining_quota,quota_date)
    values(p_user_id,p_event_key,p_kind,p_document_id,v_quota.new_count,
      v_quota.remaining,v_quota.quota_date)
    returning * into v_existing;
  return query select v_existing.id,v_existing.quota_count,v_existing.remaining_quota,
    true,v_existing.document_id,v_existing.quiz_set_id;
end $$;
revoke all on function private.consume_generation_quota_event(text,text,text,integer,uuid)
  from public, anon, authenticated;
grant execute on function private.consume_generation_quota_event(text,text,text,integer,uuid)
  to service_role;

-- Atomic persistence for level-up/regenerate.  The route calls this only after
-- Gemini output has passed validation, so failed AI calls do not consume quota.
create or replace function private.create_quiz_extra_generation(
  p_user_id text, p_document_id uuid, p_label text, p_questions jsonb,
  p_event_key text, p_daily_limit integer
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare v_event record; v_set public.quiz_sets%rowtype; v_label text;
begin
  if not exists(select 1 from public.documents where id=p_document_id and user_id=p_user_id and deleted_at is null)
    then raise exception 'DOCUMENT_NOT_FOUND'; end if;
  select * into v_event from private.consume_generation_quota_event(
    p_user_id,p_event_key,'quiz_extra',p_daily_limit,p_document_id);
  if not v_event.created then
    if v_event.quiz_set_id is null then raise exception 'IDEMPOTENCY_RESULT_MISSING'; end if;
    select * into v_set from public.quiz_sets where id=v_event.quiz_set_id;
    return jsonb_build_object('id',v_set.id,'label',v_set.label,
      'question_count',(select count(*) from public.quiz_questions where quiz_set_id=v_set.id),
      'remaining',v_event.remaining,'created',false);
  end if;
  v_label := coalesce(nullif(trim(p_label),''),'Quiz tambahan');
  insert into public.quiz_sets(document_id,label) values(p_document_id,v_label) returning * into v_set;
  insert into public.quiz_questions(document_id,quiz_set_id,question,options,correct_index,explanation,difficulty)
    select p_document_id,v_set.id,x.question,x.options,x.correct_index,x.explanation,
      case when x.difficulty in ('easy','medium','hard') then x.difficulty else 'medium' end
    from jsonb_to_recordset(coalesce(p_questions,'[]')) as x(
      question text, options jsonb, correct_index integer, explanation text, difficulty text);
  update public.generation_quota_events set quiz_set_id=v_set.id where id=v_event.event_id;
  return jsonb_build_object('id',v_set.id,'label',v_set.label,
    'question_count',(select count(*) from public.quiz_questions where quiz_set_id=v_set.id),
    'remaining',v_event.remaining,'created',true);
end $$;
revoke all on function private.create_quiz_extra_generation(text,uuid,text,jsonb,text,integer)
  from public, anon, authenticated;
grant execute on function private.create_quiz_extra_generation(text,uuid,text,jsonb,text,integer)
  to service_role;

-- Replace selected-content start so confirmed documents reuse their paid
-- document event. Legacy documents receive that event on first generation.
create or replace function private.start_selected_content_generation(
  p_user_id text, p_document_id uuid, p_daily_limit integer
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare v_document public.documents%rowtype; v_job public.generation_jobs%rowtype;
  v_keyword_ids uuid[]; v_keyword_count integer; v_batch_count integer; v_event record;
begin
  select * into v_document from public.documents where id=p_document_id and user_id=p_user_id and deleted_at is null for update;
  if not found then raise exception 'DOCUMENT_NOT_FOUND'; end if;
  if v_document.status <> 'ready_for_selection' then raise exception 'DOCUMENT_NOT_READY'; end if;
  select array_agg(k.id order by k.created_at,k.id),count(*)::integer into v_keyword_ids,v_keyword_count
    from public.candidate_keywords k where k.document_id=p_document_id and k.is_selected;
  if coalesce(v_keyword_count,0)=0 then raise exception 'NO_KEYWORDS_SELECTED'; end if;
  if exists(select 1 from public.candidate_keywords k where k.document_id=p_document_id and k.is_selected and
    (k.chunk_id is null or not exists(select 1 from public.document_chunks c where c.id=k.chunk_id and c.document_id=p_document_id)))
    then raise exception 'SELECTED_KEYWORD_MISSING_CHUNK'; end if;
  select * into v_job from public.generation_jobs where document_id=p_document_id and status in ('queued','processing') order by created_at desc limit 1;
  if found then
    if v_job.selected_keyword_ids <> v_keyword_ids then raise exception 'GENERATION_IN_PROGRESS'; end if;
    return jsonb_build_object('id',v_job.id,'status',v_job.status,'remaining_quota',v_job.remaining_quota,'created',false); end if;
  select * into v_job from public.generation_jobs where document_id=p_document_id and status='completed' and selected_keyword_ids=v_keyword_ids order by created_at desc limit 1;
  if found then return jsonb_build_object('id',v_job.id,'status',v_job.status,'remaining_quota',v_job.remaining_quota,'created',false); end if;
  select * into v_event from private.consume_generation_quota_event(p_user_id,'document:'||p_document_id,'document_pipeline',p_daily_limit,p_document_id);
  v_batch_count := ceil(v_keyword_count::numeric/10)::integer;
  insert into public.generation_jobs(document_id,user_id,selected_keyword_ids,expected_items,quota_count,remaining_quota)
    values(p_document_id,p_user_id,v_keyword_ids,v_batch_count,v_event.new_count,v_event.remaining) returning * into v_job;
  with selected as (select k.id,k.chunk_id,row_number() over(order by k.created_at,k.id) ordinal,
    ((row_number() over(order by k.created_at,k.id)-1)/10)::integer batch_index from public.candidate_keywords k where k.document_id=p_document_id and k.is_selected), batches as (
    select batch_index,(array_agg(chunk_id order by ordinal))[1] representative_chunk_id,array_agg(id order by ordinal) keyword_ids from selected group by batch_index)
  insert into public.generation_job_items(job_id,chunk_id,batch_index,keyword_ids) select v_job.id,representative_chunk_id,batch_index,keyword_ids from batches order by batch_index;
  return jsonb_build_object('id',v_job.id,'status',v_job.status,'remaining_quota',v_job.remaining_quota,'created',true);
end $$;
revoke all on function private.start_selected_content_generation(text,uuid,integer) from public,anon,authenticated;
grant execute on function private.start_selected_content_generation(text,uuid,integer) to service_role;
