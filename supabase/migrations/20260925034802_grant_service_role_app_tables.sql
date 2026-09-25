-- The server-side supabase-js client authenticates as service_role. RLS bypass
-- does not imply object privileges, so explicitly grant only the CRUD rights
-- used by the application repositories and quota checks.
grant select, update on table public."user" to service_role;

grant select, insert, update, delete on table
  public.documents,
  public.flashcards,
  public.quiz_sets,
  public.quiz_questions,
  public.quiz_attempts
to service_role;
