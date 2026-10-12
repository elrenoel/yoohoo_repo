begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Recover legacy document-only cards into their original one-document decks.
insert into public.decks (id, user_id, title, created_at, updated_at)
select distinct d.id, d.user_id, d.title, d.created_at, now()
from public.flashcards f
join public.documents d on d.id = f.document_id
where f.deck_id is null
on conflict (id) do nothing;

insert into public.deck_documents (deck_id, document_id)
select distinct d.id, d.id
from public.flashcards f
join public.documents d on d.id = f.document_id
join public.decks deck on deck.id = d.id and deck.user_id = d.user_id
where f.deck_id is null
on conflict do nothing;

update public.flashcards f
set deck_id = d.id
from public.documents d
where f.document_id = d.id
  and f.deck_id is null
  and exists (
    select 1 from public.decks deck
    where deck.id = d.id and deck.user_id = d.user_id
  );

create table if not exists public.flashcard_groups (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  user_id text not null references public."user"(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flashcard_groups_deck_created_idx
  on public.flashcard_groups (deck_id, created_at);

alter table public.flashcards
  add column if not exists group_id uuid,
  add column if not exists source_document_id uuid,
  add column if not exists normalized_keyword text generated always as (lower(btrim(term))) stored;

-- A deterministic UUID makes this data migration safe to re-run.
insert into public.flashcard_groups (id, deck_id, user_id, name, created_at, updated_at)
select distinct
  (
    substr(md5('legacy-flashcard-group:' || f.deck_id::text || ':' || f.document_id::text), 1, 8) || '-' ||
    substr(md5('legacy-flashcard-group:' || f.deck_id::text || ':' || f.document_id::text), 9, 4) || '-' ||
    substr(md5('legacy-flashcard-group:' || f.deck_id::text || ':' || f.document_id::text), 13, 4) || '-' ||
    substr(md5('legacy-flashcard-group:' || f.deck_id::text || ':' || f.document_id::text), 17, 4) || '-' ||
    substr(md5('legacy-flashcard-group:' || f.deck_id::text || ':' || f.document_id::text), 21, 12)
  )::uuid,
  f.deck_id,
  d.user_id,
  left(d.title, 60),
  min(d.created_at) over (partition by f.deck_id, f.document_id),
  now()
from public.flashcards f
join public.documents d on d.id = f.document_id
where f.deck_id is not null
on conflict (id) do nothing;

update public.flashcards f
set source_document_id = coalesce(f.source_document_id, f.document_id),
    group_id = coalesce(
      f.group_id,
      (
        substr(md5('legacy-flashcard-group:' || f.deck_id::text || ':' || f.document_id::text), 1, 8) || '-' ||
        substr(md5('legacy-flashcard-group:' || f.deck_id::text || ':' || f.document_id::text), 9, 4) || '-' ||
        substr(md5('legacy-flashcard-group:' || f.deck_id::text || ':' || f.document_id::text), 13, 4) || '-' ||
        substr(md5('legacy-flashcard-group:' || f.deck_id::text || ':' || f.document_id::text), 17, 4) || '-' ||
        substr(md5('legacy-flashcard-group:' || f.deck_id::text || ':' || f.document_id::text), 21, 12)
      )::uuid
    )
where f.deck_id is not null;

alter table public.flashcards
  alter column group_id set not null,
  alter column source_document_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'flashcards_group_id_fkey') then
    alter table public.flashcards add constraint flashcards_group_id_fkey
      foreign key (group_id) references public.flashcard_groups(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'flashcards_source_document_id_fkey') then
    alter table public.flashcards add constraint flashcards_source_document_id_fkey
      foreign key (source_document_id) references public.documents(id) on delete cascade;
  end if;
end $$;

drop index if exists public.flashcards_deck_keyword_unique;
create unique index if not exists flashcards_group_normalized_keyword_unique
  on public.flashcards (group_id, normalized_keyword);
create index if not exists flashcards_group_id_idx on public.flashcards (group_id);
create index if not exists flashcards_source_document_id_idx on public.flashcards (source_document_id);

alter table public.quiz_sets
  alter column document_id drop not null,
  add column if not exists group_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quiz_sets_group_id_fkey') then
    alter table public.quiz_sets add constraint quiz_sets_group_id_fkey
      foreign key (group_id) references public.flashcard_groups(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quiz_sets_exactly_one_source_check') then
    alter table public.quiz_sets add constraint quiz_sets_exactly_one_source_check
      check (num_nonnulls(document_id, group_id) = 1);
  end if;
end $$;

create index if not exists quiz_sets_group_id_idx on public.quiz_sets (group_id);

commit;
