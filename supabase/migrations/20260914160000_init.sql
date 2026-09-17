-- 滑记核心数据模型：卡片盒、卡片、间隔复习、社区卡册、统计

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create type public.note_type as enum ('note', 'qa', 'choice', 'cloze', 'poem', 'vocab');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '学习者',
  avatar_url text,
  settings jsonb not null default '{
    "gesture": {"left": "again", "right": "good"},
    "tts": {"lang": "zh-CN", "rate": 1, "voice": ""},
    "reminder": {"enabled": false, "time": "21:00"},
    "requestRetention": 0.9,
    "newCardsPerDay": 20
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  cover text,
  author text,
  description text,
  category text not null default '综合',
  learner_count integer not null default 0,
  is_free boolean not null default true,
  price_cents integer,
  toc jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  icon text not null default '📘',
  description text,
  source_book_id uuid references public.books (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type public.note_type not null,
  fields jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  deck_id uuid not null references public.decks (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  ord integer not null default 0,
  due timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state integer not null default 0,
  last_review timestamptz,
  starred boolean not null default false,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null,
  state integer not null,
  due timestamptz not null,
  stability double precision,
  difficulty double precision,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  review_at timestamptz not null default now(),
  duration_ms integer not null default 0
);

create table public.daily_stats (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  reviews integer not null default 0,
  new_cards integer not null default 0,
  study_seconds integer not null default 0,
  primary key (owner_id, date)
);

create table public.book_notes (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  chapter text,
  type public.note_type not null,
  fields jsonb not null default '{}'::jsonb,
  importance text not null default 'normal',
  sort_order integer not null default 0
);

create table public.user_books (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  deck_id uuid references public.decks (id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (owner_id, book_id)
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index cards_owner_due_idx on public.cards (owner_id, due) where suspended = false;
create index cards_deck_idx on public.cards (deck_id);
create index notes_deck_idx on public.notes (deck_id);
create index notes_owner_idx on public.notes (owner_id);
create index decks_owner_idx on public.decks (owner_id);
create index review_logs_owner_review_idx on public.review_logs (owner_id, review_at desc);
create index book_notes_book_idx on public.book_notes (book_id, sort_order);
create index books_category_idx on public.books (category);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nickname text;
begin
  nickname := coalesce(
    new.raw_user_meta_data ->> 'nickname',
    split_part(coalesce(new.email, '学习者'), '@', 1),
    '学习者'
  );
  insert into public.profiles (id, nickname)
  values (new.id, nickname);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger decks_updated_at
  before update on public.decks
  for each row execute function private.set_updated_at();

create trigger notes_updated_at
  before update on public.notes
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.decks enable row level security;
alter table public.notes enable row level security;
alter table public.cards enable row level security;
alter table public.review_logs enable row level security;
alter table public.daily_stats enable row level security;
alter table public.books enable row level security;
alter table public.book_notes enable row level security;
alter table public.user_books enable row level security;
alter table public.feedback enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy decks_all_own on public.decks
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy notes_all_own on public.notes
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy cards_all_own on public.cards
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy review_logs_all_own on public.review_logs
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy daily_stats_all_own on public.daily_stats
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy user_books_all_own on public.user_books
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy feedback_select_own on public.feedback
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy books_select_auth on public.books
  for select to authenticated
  using (true);

create policy book_notes_select_auth on public.book_notes
  for select to authenticated
  using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('card-images', 'card-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('book-covers', 'book-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy card_images_select on storage.objects
  for select to authenticated
  using (bucket_id = 'card-images');
create policy card_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'card-images' and (storage.foldername (name))[1] = (select auth.uid())::text);
create policy card_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'card-images' and (storage.foldername (name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'card-images' and (storage.foldername (name))[1] = (select auth.uid())::text);
create policy card_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'card-images' and (storage.foldername (name))[1] = (select auth.uid())::text);

create policy book_covers_select on storage.objects
  for select to authenticated
  using (bucket_id = 'book-covers');
