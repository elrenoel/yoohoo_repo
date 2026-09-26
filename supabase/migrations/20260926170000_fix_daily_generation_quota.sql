-- Keep the five-generations-per-UTC-day limit correct for legacy users whose
-- counter was NULL when the Better Auth field was introduced.
update public."user"
set generation_count_today = 0
where generation_count_today is null;

alter table public."user"
  alter column generation_count_today set default 0;

create or replace function public.consume_generation_quota(p_user_id text, p_daily_limit integer)
returns table(new_count integer, remaining integer, quota_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_date date;
  v_today date := (now() at time zone 'utc')::date;
begin
  if p_daily_limit is null or p_daily_limit <= 0 then
    raise exception 'INVALID_DAILY_LIMIT';
  end if;

  select coalesce(generation_count_today, 0), last_generation_date::date
    into v_count, v_date
  from public."user"
  where id = p_user_id
  for update;

  if not found then raise exception 'USER_NOT_FOUND'; end if;
  if v_date is distinct from v_today then v_count := 0; end if;
  if v_count >= p_daily_limit then raise exception 'DAILY_LIMIT_REACHED'; end if;

  v_count := v_count + 1;
  update public."user"
  set generation_count_today = v_count,
      last_generation_date = v_today::text,
      updated_at = now()
  where id = p_user_id;

  return query select v_count, greatest(0, p_daily_limit - v_count), v_today;
end;
$$;

revoke all on function public.consume_generation_quota(text, integer) from public, anon, authenticated;
