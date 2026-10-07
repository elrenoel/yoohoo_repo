-- Remove the "hubungan antar materi" (concept-map) feature.
--
-- public.keyword_relations was created exclusively for the concept-map
-- instrument (see 20260930100000_keyword_relations.sql) and the deck-scoped
-- semantic links (20260930120000_semantic_keyword_relations.sql). Nothing else
-- reads or writes it. candidate_keywords.embedding existed only to build the
-- semantic links.
--
-- The pgvector extension itself is kept on purpose: public.document_chunks
-- still has a vector column that predates this feature.
drop table if exists public.keyword_relations cascade;

alter table public.candidate_keywords
  drop column if exists embedding;
