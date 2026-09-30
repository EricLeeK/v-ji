alter table public.decks
  add column if not exists color text;

alter table public.decks
  drop constraint if exists decks_color_check;

alter table public.decks
  add constraint decks_color_check
  check (color is null or color in ('sky', 'apricot', 'lilac', 'mint', 'rose', 'lemon', 'sea', 'iris'));
