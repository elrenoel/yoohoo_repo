alter table public.documents add column if not exists is_starred boolean not null default false;
alter table public.documents add column if not exists starred_at timestamptz;
create index if not exists documents_user_starred_idx
  on public.documents(user_id,is_starred,starred_at desc);
