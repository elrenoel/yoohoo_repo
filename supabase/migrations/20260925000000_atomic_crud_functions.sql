-- Atomic write paths used by the server-side Supabase client.
create or replace function public.consume_generation_quota(p_user_id text, p_daily_limit integer)
returns table(new_count integer, remaining integer, quota_date date)
language plpgsql security definer set search_path = public as $$
declare v_count integer; v_date date; v_today date := (now() at time zone 'utc')::date;
begin
  select generation_count_today, last_generation_date::date into v_count, v_date
  from public."user" where id = p_user_id for update;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  if v_date is distinct from v_today then v_count := 0; end if;
  if v_count >= p_daily_limit then raise exception 'DAILY_LIMIT_REACHED'; end if;
  v_count := v_count + 1;
  update public."user" set generation_count_today = v_count, last_generation_date = v_today::text, updated_at = now() where id = p_user_id;
  return query select v_count, greatest(0, p_daily_limit - v_count), v_today;
end $$;

create or replace function public.create_generated_document(
  p_user_id text, p_title text, p_raw_text text, p_content_language text,
  p_flashcards jsonb, p_questions jsonb, p_daily_limit integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_doc documents; v_set_id uuid; v_quota record;
begin
  select * into v_quota from consume_generation_quota(p_user_id, p_daily_limit);
  insert into documents(user_id,title,raw_text,content_language) values(p_user_id,p_title,p_raw_text,coalesce(p_content_language,'auto')) returning * into v_doc;
  insert into flashcards(document_id,term,definition)
    select v_doc.id, x.term, x.definition from jsonb_to_recordset(coalesce(p_flashcards,'[]')) as x(term text, definition text);
  insert into quiz_sets(document_id,label) values(v_doc.id,'Set 1') returning id into v_set_id;
  insert into quiz_questions(document_id,quiz_set_id,question,options,correct_index)
    select v_doc.id,v_set_id,x.question,x.options,x.correct_index from jsonb_to_recordset(coalesce(p_questions,'[]')) as x(question text,options jsonb,correct_index integer);
  return jsonb_build_object('id',v_doc.id,'created_at',v_doc.created_at,'new_count',v_quota.new_count,'remaining',v_quota.remaining);
end $$;

create or replace function public.create_quiz_set(
  p_user_id text, p_document_id uuid, p_label text, p_questions jsonb, p_daily_limit integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_set quiz_sets; v_quota record; v_label text;
begin
  if not exists(select 1 from documents where id=p_document_id and user_id=p_user_id and deleted_at is null) then raise exception 'DOCUMENT_NOT_FOUND'; end if;
  select * into v_quota from consume_generation_quota(p_user_id,p_daily_limit);
  v_label := coalesce(nullif(trim(p_label),''),'Set ' || ((select count(*) from quiz_sets where document_id=p_document_id)+1));
  insert into quiz_sets(document_id,label) values(p_document_id,v_label) returning * into v_set;
  insert into quiz_questions(document_id,quiz_set_id,question,options,correct_index)
    select p_document_id,v_set.id,x.question,x.options,x.correct_index from jsonb_to_recordset(coalesce(p_questions,'[]')) as x(question text,options jsonb,correct_index integer);
  return jsonb_build_object('id',v_set.id,'label',v_set.label,'new_count',v_quota.new_count,'remaining',v_quota.remaining);
end $$;

create or replace function public.replace_generated_content(
  p_user_id text, p_document_id uuid, p_flashcards jsonb, p_questions jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_set_id uuid;
begin
  if not exists(select 1 from documents where id=p_document_id and user_id=p_user_id and deleted_at is null) then raise exception 'DOCUMENT_NOT_FOUND'; end if;
  delete from flashcards where document_id=p_document_id;
  select id into v_set_id from quiz_sets where document_id=p_document_id order by created_at limit 1;
  if v_set_id is null then insert into quiz_sets(document_id,label) values(p_document_id,'Set 1') returning id into v_set_id; end if;
  delete from quiz_questions where quiz_set_id=v_set_id;
  insert into flashcards(document_id,term,definition) select p_document_id,x.term,x.definition from jsonb_to_recordset(coalesce(p_flashcards,'[]')) as x(term text,definition text);
  insert into quiz_questions(document_id,quiz_set_id,question,options,correct_index)
    select p_document_id,v_set_id,x.question,x.options,x.correct_index from jsonb_to_recordset(coalesce(p_questions,'[]')) as x(question text,options jsonb,correct_index integer);
  return jsonb_build_object('quiz_set_id',v_set_id);
end $$;

revoke all on function public.consume_generation_quota(text,integer) from public, anon, authenticated;
revoke all on function public.create_generated_document(text,text,text,text,jsonb,jsonb,integer) from public, anon, authenticated;
revoke all on function public.create_quiz_set(text,uuid,text,jsonb,integer) from public, anon, authenticated;
revoke all on function public.replace_generated_content(text,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_generated_document(text,text,text,text,jsonb,jsonb,integer) to service_role;
grant execute on function public.create_quiz_set(text,uuid,text,jsonb,integer) to service_role;
grant execute on function public.replace_generated_content(text,uuid,jsonb,jsonb) to service_role;
