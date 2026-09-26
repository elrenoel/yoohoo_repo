-- RAG overview is generated once before fan-out and read by every worker.
-- It is server-only data; no browser policy/grant is added here.
alter table public.documents
  add column if not exists document_summary text;

comment on column public.documents.document_summary is
  'Server-generated learning-topic overview used as context for RAG keyword extraction.';
