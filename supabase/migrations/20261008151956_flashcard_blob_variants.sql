-- Store the Figma front-blob choice once so it remains stable across renders,
-- public snapshots, and forks. Existing rows are backfilled deterministically.

alter table public.flashcards
  add column if not exists blob_variant smallint;

update public.flashcards
set blob_variant = (
  mod(
    (('x' || substr(md5(id::text), 1, 7))::bit(28)::int),
    5
  ) + 1
)::smallint
where blob_variant is null;

alter table public.flashcards
  alter column blob_variant set default 1,
  alter column blob_variant set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.flashcards'::regclass
      and conname = 'flashcards_blob_variant_check'
  ) then
    alter table public.flashcards
      add constraint flashcards_blob_variant_check
      check (blob_variant between 1 and 5);
  end if;
end
$$;

comment on column public.flashcards.blob_variant is
  'Stable Figma front-blob variant. Valid values are 1 through 5.';

alter table public.public_deck_cards
  add column if not exists blob_variant smallint;

update public.public_deck_cards
set blob_variant = (
  mod(
    (('x' || substr(md5(id::text), 1, 7))::bit(28)::int),
    5
  ) + 1
)::smallint
where blob_variant is null;

alter table public.public_deck_cards
  alter column blob_variant set default 1,
  alter column blob_variant set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.public_deck_cards'::regclass
      and conname = 'public_deck_cards_blob_variant_check'
  ) then
    alter table public.public_deck_cards
      add constraint public_deck_cards_blob_variant_check
      check (blob_variant between 1 and 5);
  end if;
end
$$;

comment on column public.public_deck_cards.blob_variant is
  'Copied Figma front-blob variant from the source flashcard snapshot.';
