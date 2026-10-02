-- Workspaces (desks) may contain one or more source documents.
create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public."user"(id) on delete cascade,
  title text not null,
  is_starred boolean not null default false,
  starred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deck_documents (
  deck_id uuid not null references public.decks(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (deck_id, document_id)
);

create index if not exists decks_user_updated_idx on public.decks(user_id, updated_at desc);
create index if not exists decks_user_starred_idx on public.decks(user_id, is_starred, starred_at desc);
create index if not exists deck_documents_document_idx on public.deck_documents(document_id);

alter table public.decks enable row level security;
alter table public.deck_documents enable row level security;
drop policy if exists "decks owner read" on public.decks;
create policy "decks owner read" on public.decks for select to authenticated using (user_id = auth.uid()::text);
drop policy if exists "deck documents owner read" on public.deck_documents;
create policy "deck documents owner read" on public.deck_documents for select to authenticated using (exists (select 1 from public.decks d where d.id = deck_documents.deck_id and d.user_id = auth.uid()::text));
grant select, insert, update, delete on public.decks, public.deck_documents to service_role;

-- Preserve existing documents by creating a one-document desk for each one.
insert into public.decks (id, user_id, title, created_at, updated_at)
select d.id, d.user_id, d.title, d.created_at, d.created_at
from public.documents d
where d.deleted_at is null
on conflict (id) do nothing;
insert into public.deck_documents (deck_id, document_id)
select d.id, d.id from public.documents d where d.deleted_at is null
on conflict (deck_id, document_id) do nothing;
