-- Rollback of 20261005100000_drop_keyword_relations.sql.
-- Restores the schema (final state after 20260930120000), not the data.
create extension if not exists vector;

do $rollback$
declare
  vector_schema text;
begin
  select n.nspname into vector_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'vector';

  if vector_schema is null then
    raise exception 'pgvector extension is not installed';
  end if;

  execute format(
    'alter table public.candidate_keywords add column if not exists embedding %I.vector(768)',
    vector_schema
  );
end
$rollback$;

create table if not exists public.keyword_relations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  deck_id uuid references public.decks(id) on delete cascade,
  from_keyword_id uuid not null references public.candidate_keywords(id) on delete cascade,
  to_keyword_id uuid not null references public.candidate_keywords(id) on delete cascade,
  relation_type text not null check (relation_type in ('mentioned', 'co_occurs', 'semantic')),
  created_at timestamptz not null default now()
);

create index if not exists keyword_relations_document_idx on public.keyword_relations(document_id);
create index if not exists keyword_relations_from_idx on public.keyword_relations(from_keyword_id);
create index if not exists keyword_relations_to_idx on public.keyword_relations(to_keyword_id);
create index if not exists keyword_relations_deck_idx
  on public.keyword_relations(deck_id, relation_type);

create unique index if not exists keyword_relations_scope_unique
  on public.keyword_relations(coalesce(deck_id, '00000000-0000-0000-0000-000000000000'::uuid), from_keyword_id, to_keyword_id);

alter table public.keyword_relations enable row level security;
drop policy if exists "keyword relations owner read" on public.keyword_relations;
create policy "keyword relations owner read" on public.keyword_relations
  for select to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = keyword_relations.document_id and d.user_id = auth.uid()::text
  ));

grant select, insert, update, delete on public.keyword_relations to service_role;
