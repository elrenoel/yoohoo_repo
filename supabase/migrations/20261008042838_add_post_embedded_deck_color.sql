alter table public.posts
  add column if not exists embedded_deck_color text not null default 'green';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'posts_embedded_deck_color_check'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_embedded_deck_color_check
      check (embedded_deck_color in ('green', 'blue', 'peach', 'lavender', 'rose'));
  end if;
end $$;
