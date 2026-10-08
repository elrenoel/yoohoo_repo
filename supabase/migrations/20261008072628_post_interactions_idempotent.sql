-- Idempotent, post-only social interactions.
-- Better Auth user ids are text in public."user"; post ids are UUIDs.

alter table public.posts
  add column if not exists like_count bigint not null default 0,
  add column if not exists repost_count bigint not null default 0;

create table if not exists public.post_likes (
  user_id text not null references public."user"(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.post_reposts (
  user_id text not null references public."user"(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.post_saves (
  user_id text not null references public."user"(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'post_likes_user_post_key' and conrelid = 'public.post_likes'::regclass) then
    alter table public.post_likes add constraint post_likes_user_post_key unique (user_id, post_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'post_reposts_user_post_key' and conrelid = 'public.post_reposts'::regclass) then
    alter table public.post_reposts add constraint post_reposts_user_post_key unique (user_id, post_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'post_saves_user_post_key' and conrelid = 'public.post_saves'::regclass) then
    alter table public.post_saves add constraint post_saves_user_post_key unique (user_id, post_id);
  end if;
end $$;

create index if not exists post_likes_post_id_idx on public.post_likes(post_id);
create index if not exists post_likes_user_post_idx on public.post_likes(user_id, post_id);
create index if not exists post_reposts_post_id_idx on public.post_reposts(post_id);
create index if not exists post_reposts_user_post_idx on public.post_reposts(user_id, post_id);
create index if not exists post_saves_post_id_idx on public.post_saves(post_id);
create index if not exists post_saves_user_post_idx on public.post_saves(user_id, post_id);

-- Preserve existing post interaction state while public deck interactions stay
-- in the legacy polymorphic tables.
insert into public.post_likes(user_id, post_id, created_at)
select user_id, target_id, created_at from public.likes where target_type = 'post'
on conflict (user_id, post_id) do nothing;

insert into public.post_reposts(user_id, post_id, created_at)
select user_id, target_id, created_at from public.reposts where target_type = 'post'
on conflict (user_id, post_id) do nothing;

insert into public.post_saves(user_id, post_id, created_at)
select user_id, target_id, created_at from public.bookmarks where target_type = 'post'
on conflict (user_id, post_id) do nothing;

update public.posts p set
  like_count = (select count(*) from public.post_likes l where l.post_id = p.id),
  repost_count = (select count(*) from public.post_reposts r where r.post_id = p.id);

create or replace function public.sync_post_like_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  end if;
  update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

create or replace function public.sync_post_repost_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set repost_count = repost_count + 1 where id = new.post_id;
    return new;
  end if;
  update public.posts set repost_count = greatest(repost_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists post_likes_sync_count on public.post_likes;
create trigger post_likes_sync_count after insert or delete on public.post_likes
for each row execute function public.sync_post_like_count();

drop trigger if exists post_reposts_sync_count on public.post_reposts;
create trigger post_reposts_sync_count after insert or delete on public.post_reposts
for each row execute function public.sync_post_repost_count();

alter table public.post_likes enable row level security;
alter table public.post_reposts enable row level security;
alter table public.post_saves enable row level security;

revoke all on public.post_likes, public.post_reposts, public.post_saves from anon;
revoke all on public.post_likes, public.post_reposts, public.post_saves from authenticated;
grant select, insert, delete on public.post_likes, public.post_reposts, public.post_saves to authenticated;

drop policy if exists "post likes owner select" on public.post_likes;
drop policy if exists "post likes owner insert" on public.post_likes;
drop policy if exists "post likes owner delete" on public.post_likes;
create policy "post likes owner select" on public.post_likes for select to authenticated using ((select auth.uid())::text = user_id);
create policy "post likes owner insert" on public.post_likes for insert to authenticated with check ((select auth.uid())::text = user_id);
create policy "post likes owner delete" on public.post_likes for delete to authenticated using ((select auth.uid())::text = user_id);

drop policy if exists "post reposts owner select" on public.post_reposts;
drop policy if exists "post reposts owner insert" on public.post_reposts;
drop policy if exists "post reposts owner delete" on public.post_reposts;
create policy "post reposts owner select" on public.post_reposts for select to authenticated using ((select auth.uid())::text = user_id);
create policy "post reposts owner insert" on public.post_reposts for insert to authenticated with check ((select auth.uid())::text = user_id);
create policy "post reposts owner delete" on public.post_reposts for delete to authenticated using ((select auth.uid())::text = user_id);

drop policy if exists "post saves owner select" on public.post_saves;
drop policy if exists "post saves owner insert" on public.post_saves;
drop policy if exists "post saves owner delete" on public.post_saves;
create policy "post saves owner select" on public.post_saves for select to authenticated using ((select auth.uid())::text = user_id);
create policy "post saves owner insert" on public.post_saves for insert to authenticated with check ((select auth.uid())::text = user_id);
create policy "post saves owner delete" on public.post_saves for delete to authenticated using ((select auth.uid())::text = user_id);

comment on table public.post_likes is 'Idempotent likes for posts; counters are maintained by database triggers.';
comment on table public.post_reposts is 'Idempotent reposts for posts; counters are maintained by database triggers.';
comment on table public.post_saves is 'Private saved-post state; no public counter.';
