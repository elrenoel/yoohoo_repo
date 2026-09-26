-- Cross-reference relations.  Suggested rows intentionally have no target
-- flashcard until the user chooses to add the concept.
create table if not exists public.flashcard_relations (
  id uuid primary key default gen_random_uuid(),
  from_flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  to_flashcard_id uuid references public.flashcards(id) on delete cascade,
  relation_type text not null default 'linked' check (relation_type in ('linked','suggested')),
  suggested_term text,
  source_chunk_id uuid references public.document_chunks(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.flashcard_relations add column if not exists relation_type text not null default 'linked';
alter table public.flashcard_relations add column if not exists suggested_term text;
alter table public.flashcard_relations add column if not exists source_chunk_id uuid references public.document_chunks(id) on delete set null;
alter table public.flashcard_relations alter column to_flashcard_id drop not null;
alter table public.flashcard_relations drop constraint if exists flashcard_relations_relation_type_check;
alter table public.flashcard_relations add constraint flashcard_relations_relation_type_check check (relation_type in ('linked','suggested'));
create index if not exists flashcard_relations_from_idx on public.flashcard_relations(from_flashcard_id);
create index if not exists flashcard_relations_source_idx on public.flashcard_relations(source_chunk_id);
create unique index if not exists flashcard_relations_suggested_unique
  on public.flashcard_relations(from_flashcard_id, lower(suggested_term))
  where relation_type='suggested' and suggested_term is not null;
create unique index if not exists flashcard_relations_linked_unique
  on public.flashcard_relations(from_flashcard_id,to_flashcard_id)
  where relation_type='linked' and to_flashcard_id is not null;

-- Refresh both existing linked references and cheap, candidate-keyword based
-- suggestions.  No embedding/semantic search is used here by design.
create or replace function private.refresh_flashcard_relations(p_user_id text, p_flashcard_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare v_document_id uuid;
begin
  select f.document_id into v_document_id
  from public.flashcards f join public.documents d on d.id=f.document_id
  where f.id=p_flashcard_id and d.user_id=p_user_id and d.deleted_at is null;
  if v_document_id is null then raise exception 'FLASHCARD_NOT_FOUND'; end if;

  -- Rebuild this source card so stale/wrong-direction rows from older matching
  -- runs cannot leak into the UI.
  delete from public.flashcard_relations where from_flashcard_id=p_flashcard_id;

  -- Terms already represented by another card become linked.
  insert into public.flashcard_relations(from_flashcard_id,to_flashcard_id,relation_type,suggested_term,source_chunk_id)
  select p_flashcard_id, target.id, 'linked', null, null
  from public.flashcards source
  join public.flashcards target on target.document_id=source.document_id and target.id<>source.id
    and lower(trim(target.term))<>lower(trim(source.term))
  where source.id=p_flashcard_id
    and position(lower(trim(target.term)) in lower(coalesce(source.definition,''))) > 0
  on conflict do nothing;

  -- Candidate keywords are the bounded technical-term vocabulary extracted by
  -- the RAG pipeline. Use them to avoid treating ordinary words as concepts.
  insert into public.flashcard_relations(from_flashcard_id,to_flashcard_id,relation_type,suggested_term,source_chunk_id)
  select p_flashcard_id, null, 'suggested', k.term, c.id
  from public.candidate_keywords k
  cross join lateral (select c0.id from public.document_chunks c0
    where c0.document_id=v_document_id and c0.content ilike ('%'||k.term||'%')
    order by c0.chunk_index limit 1) c
  where k.document_id=v_document_id
    and k.term ~ '[[:upper:]]|[[:space:]]'
    and position(lower(trim(k.term)) in lower(coalesce((select definition from public.flashcards where id=p_flashcard_id),''))) > 0
    and not exists (select 1 from public.flashcards f where f.document_id=v_document_id and lower(trim(f.term))=lower(trim(k.term)))
  on conflict (from_flashcard_id, lower(suggested_term)) where relation_type='suggested' and suggested_term is not null
    do update set source_chunk_id=excluded.source_chunk_id;
end $$;
revoke all on function private.refresh_flashcard_relations(text,uuid) from public,anon,authenticated;
grant execute on function private.refresh_flashcard_relations(text,uuid) to service_role;
