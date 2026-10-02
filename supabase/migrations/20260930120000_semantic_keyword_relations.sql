-- Semantic concept links across documents in the same deck.
create extension if not exists vector;

-- Existing Supabase projects may have pgvector installed in either `public`
-- or `extensions`. Resolve the actual extension schema instead of assuming it.
do $migration$
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
$migration$;

alter table public.keyword_relations
  add column if not exists deck_id uuid references public.decks(id) on delete cascade;

alter table public.keyword_relations
  drop constraint if exists keyword_relations_relation_type_check;

alter table public.keyword_relations
  add constraint keyword_relations_relation_type_check
  check (relation_type in ('mentioned', 'co_occurs', 'semantic'));

create index if not exists keyword_relations_deck_idx
  on public.keyword_relations(deck_id, relation_type);

-- A pair may legitimately occur in more than one deck. Keep the old
-- document-scoped rows unique while allowing deck-scoped semantic rows.
alter table public.keyword_relations
  drop constraint if exists keyword_relations_from_keyword_id_to_keyword_id_key;
create unique index if not exists keyword_relations_scope_unique
  on public.keyword_relations(coalesce(deck_id, '00000000-0000-0000-0000-000000000000'::uuid), from_keyword_id, to_keyword_id);

-- Existing textual links remain document-scoped. Semantic links always carry
-- the deck that made the cross-document relationship possible.
