create index if not exists user_events_author_id_idx
  on public.user_events (author_id);

create index if not exists user_author_affinity_author_id_idx
  on public.user_author_affinity (author_id);
