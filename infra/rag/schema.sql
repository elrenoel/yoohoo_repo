-- Raw SQL only; additional runtime bookkeeping for idempotency and progress.
begin;
alter table public.document_chunks
  add column if not exists scan_pages jsonb not null default '[]'::jsonb,
  add column if not exists processed_at timestamptz,
  add column if not exists processing_error text;
create unique index if not exists document_chunks_document_index_unique
  on public.document_chunks(document_id,chunk_index);
commit;
