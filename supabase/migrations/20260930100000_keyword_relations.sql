-- Relationships between extracted concepts used by the concept-map instrument.
create table if not exists public.keyword_relations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  from_keyword_id uuid not null references public.candidate_keywords(id) on delete cascade,
  to_keyword_id uuid not null references public.candidate_keywords(id) on delete cascade,
  relation_type text not null check (relation_type in ('mentioned', 'co_occurs')),
  created_at timestamptz not null default now(),
  unique (from_keyword_id, to_keyword_id)
);

create index if not exists keyword_relations_document_idx on public.keyword_relations(document_id);
create index if not exists keyword_relations_from_idx on public.keyword_relations(from_keyword_id);
create index if not exists keyword_relations_to_idx on public.keyword_relations(to_keyword_id);

alter table public.keyword_relations enable row level security;
drop policy if exists "keyword relations owner read" on public.keyword_relations;
create policy "keyword relations owner read" on public.keyword_relations
  for select to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = keyword_relations.document_id and d.user_id = auth.uid()::text
  ));

grant select, insert, update, delete on public.keyword_relations to service_role;
