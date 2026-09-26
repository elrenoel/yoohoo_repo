-- Ensure relation refreshes remove stale links produced by older matching runs.
create or replace function private.refresh_flashcard_relations(p_user_id text, p_flashcard_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare v_document_id uuid;
begin
  select f.document_id into v_document_id from public.flashcards f
    join public.documents d on d.id=f.document_id
    where f.id=p_flashcard_id and d.user_id=p_user_id and d.deleted_at is null;
  if v_document_id is null then raise exception 'FLASHCARD_NOT_FOUND'; end if;
  delete from public.flashcard_relations where from_flashcard_id=p_flashcard_id;
  insert into public.flashcard_relations(from_flashcard_id,to_flashcard_id,relation_type,suggested_term,source_chunk_id)
  select p_flashcard_id,target.id,'linked',null,null
    from public.flashcards source join public.flashcards target
      on target.document_id=source.document_id and target.id<>source.id
    where source.id=p_flashcard_id
      and position(lower(trim(target.term)) in lower(coalesce(source.definition,'')))>0
  on conflict do nothing;
  insert into public.flashcard_relations(from_flashcard_id,to_flashcard_id,relation_type,suggested_term,source_chunk_id)
  select p_flashcard_id,null,'suggested',k.term,c.id
    from public.candidate_keywords k
    cross join lateral (select c0.id from public.document_chunks c0
      where c0.document_id=v_document_id and c0.content ilike ('%'||k.term||'%')
      order by c0.chunk_index limit 1) c
    where k.document_id=v_document_id and k.term ~ '[[:upper:]]|[[:space:]]'
      and position(lower(trim(k.term)) in lower(coalesce((select definition from public.flashcards where id=p_flashcard_id),'')))>0
      and not exists (select 1 from public.flashcards f where f.document_id=v_document_id and lower(trim(f.term))=lower(trim(k.term)))
  on conflict (from_flashcard_id,lower(suggested_term)) where relation_type='suggested' and suggested_term is not null
    do update set source_chunk_id=excluded.source_chunk_id;
end $$;
revoke all on function private.refresh_flashcard_relations(text,uuid) from public,anon,authenticated;
grant execute on function private.refresh_flashcard_relations(text,uuid) to service_role;
