-- A generation item is now a bounded keyword batch, not one source chunk.
-- Keep chunk_id for historical rows and its existing FK; new batches use it only
-- as a representative source chunk while keyword_ids identifies the full batch.
alter table public.generation_job_items
  add column if not exists batch_index integer,
  add column if not exists keyword_ids uuid[] not null default '{}'::uuid[];

with numbered as (
  select id, row_number() over (partition by job_id order by created_at, id) - 1 as batch_index
  from public.generation_job_items
)
update public.generation_job_items item
set batch_index = numbered.batch_index
from numbered
where item.id = numbered.id and item.batch_index is null;

update public.generation_job_items item
set keyword_ids = coalesce(source.keyword_ids, '{}'::uuid[])
from (
  select i.id, array_agg(k.id order by k.created_at, k.id) as keyword_ids
  from public.generation_job_items i
  join public.generation_jobs j on j.id = i.job_id
  join public.candidate_keywords k
    on k.document_id = j.document_id
   and k.chunk_id = i.chunk_id
   and k.id = any(j.selected_keyword_ids)
  where cardinality(i.keyword_ids) = 0
  group by i.id
) source
where item.id = source.id;

alter table public.generation_job_items
  alter column batch_index set not null;

alter table public.generation_job_items
  drop constraint if exists generation_job_items_job_id_chunk_id_key;

create unique index if not exists generation_job_items_job_batch_unique
  on public.generation_job_items(job_id, batch_index);

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
  v_batch_count integer;
  v_quota record;
begin
  select * into v_document
  from public.documents
  where id = p_document_id and user_id = p_user_id and deleted_at is null
  for update;

  if not found then raise exception 'DOCUMENT_NOT_FOUND'; end if;
  if v_document.status <> 'ready_for_selection' then raise exception 'DOCUMENT_NOT_READY'; end if;

  select array_agg(k.id order by k.created_at, k.id), count(*)::integer
    into v_keyword_ids, v_keyword_count
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
  v_batch_count := ceil(v_keyword_count::numeric / 10)::integer;

  insert into public.generation_jobs (
    document_id, user_id, selected_keyword_ids, expected_items, quota_count, remaining_quota
  ) values (
    p_document_id, p_user_id, v_keyword_ids, v_batch_count, v_quota.new_count, v_quota.remaining
  ) returning * into v_job;

  with selected as (
    select k.id, k.chunk_id,
      row_number() over (order by k.created_at, k.id) as ordinal,
      ((row_number() over (order by k.created_at, k.id) - 1) / 10)::integer as batch_index
    from public.candidate_keywords k
    where k.document_id = p_document_id and k.is_selected is true
  ), batches as (
    select batch_index,
      (array_agg(chunk_id order by ordinal))[1] as representative_chunk_id,
      array_agg(id order by ordinal) as keyword_ids
    from selected
    group by batch_index
  )
  insert into public.generation_job_items(job_id, chunk_id, batch_index, keyword_ids)
  select v_job.id, representative_chunk_id, batch_index, keyword_ids
  from batches
  order by batch_index;

  return jsonb_build_object('id', v_job.id, 'status', v_job.status,
    'remaining_quota', v_job.remaining_quota, 'created', true);
end;
$$;

revoke all on function private.start_selected_content_generation(text, uuid, integer) from public, anon, authenticated;
grant execute on function private.start_selected_content_generation(text, uuid, integer) to service_role;
