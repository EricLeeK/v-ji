-- AI 制卡：资料、任务、草稿、用量，以及保存/导入原子 RPC

alter table public.notes
  add column if not exists layout text not null default 'minimal',
  add column if not exists source jsonb;

alter table public.notes
  drop constraint if exists notes_layout_check;
alter table public.notes
  add constraint notes_layout_check
  check (layout in ('minimal', 'emphasis', 'illustrated'));

create unique index if not exists cards_note_ord_uidx on public.cards (note_id, ord);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  deck_id uuid references public.decks (id) on delete set null,
  new_deck_name text,
  instruction text not null default '',
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in (
      'queued', 'reading', 'organizing', 'generating', 'checking',
      'ready', 'failed', 'imported', 'cancelled'
    )),
  stage jsonb not null default '{}'::jsonb,
  outline jsonb,
  workflow_run_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_jobs (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'text', 'image', 'pdf', 'url', 'docx', 'pptx', 'xlsx', 'audio', 'video'
  )),
  name text not null,
  mime text,
  size_bytes integer,
  storage_path text,
  page_range jsonb,
  meta jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'failed')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_chunks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_jobs (id) on delete cascade,
  source_id uuid not null references public.ai_sources (id) on delete cascade,
  ord integer not null default 0,
  locator jsonb not null default '{}'::jsonb,
  text text not null default '',
  image_path text,
  token_estimate integer not null default 0
);

create table if not exists public.ai_cards (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_jobs (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  ord integer not null default 0,
  type public.note_type not null,
  fields jsonb not null default '{}'::jsonb,
  layout text not null default 'minimal'
    check (layout in ('minimal', 'emphasis', 'illustrated')),
  sources jsonb not null default '[]'::jsonb,
  flags text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'accepted', 'rejected', 'imported')),
  edited boolean not null default false,
  note_id uuid unique references public.notes (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid references public.ai_jobs (id) on delete set null,
  model text not null,
  prompt_tokens integer not null default 0,
  cache_hit_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_jobs_owner_created_idx on public.ai_jobs (owner_id, created_at desc);
create index if not exists ai_jobs_deck_idx on public.ai_jobs (deck_id);
create index if not exists ai_sources_job_idx on public.ai_sources (job_id, sort_order);
create index if not exists ai_sources_owner_idx on public.ai_sources (owner_id);
create index if not exists ai_chunks_job_idx on public.ai_chunks (job_id, ord);
create index if not exists ai_chunks_source_idx on public.ai_chunks (source_id);
create index if not exists ai_cards_job_idx on public.ai_cards (job_id, ord);
create index if not exists ai_cards_owner_idx on public.ai_cards (owner_id);
create index if not exists ai_usage_owner_created_idx on public.ai_usage (owner_id, created_at desc);
create index if not exists ai_usage_job_idx on public.ai_usage (job_id);

create trigger ai_jobs_updated_at
  before update on public.ai_jobs
  for each row execute function private.set_updated_at();

alter table public.ai_jobs enable row level security;
alter table public.ai_sources enable row level security;
alter table public.ai_chunks enable row level security;
alter table public.ai_cards enable row level security;
alter table public.ai_usage enable row level security;

create policy ai_jobs_all_own on public.ai_jobs
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy ai_sources_all_own on public.ai_sources
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy ai_chunks_all_own on public.ai_chunks
  for all to authenticated
  using (exists (
    select 1 from public.ai_jobs j
    where j.id = ai_chunks.job_id and j.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.ai_jobs j
    where j.id = ai_chunks.job_id and j.owner_id = (select auth.uid())
  ));

create policy ai_cards_all_own on public.ai_cards
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy ai_usage_select_own on public.ai_usage
  for select to authenticated
  using (owner_id = (select auth.uid()));
create policy ai_usage_insert_own on public.ai_usage
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ai-sources',
  'ai-sources',
  false,
  52428800,
  array[
    'text/plain',
    'text/markdown',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

create policy ai_sources_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ai-sources'
    and (storage.foldername (name))[1] = (select auth.uid())::text
  );
create policy ai_sources_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ai-sources'
    and (storage.foldername (name))[1] = (select auth.uid())::text
  );
create policy ai_sources_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'ai-sources'
    and (storage.foldername (name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'ai-sources'
    and (storage.foldername (name))[1] = (select auth.uid())::text
  );
create policy ai_sources_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ai-sources'
    and (storage.foldername (name))[1] = (select auth.uid())::text
  );

create or replace function private.note_ords(p_type public.note_type, p_fields jsonb)
returns integer[]
language plpgsql
immutable
set search_path = public
as $$
declare
  result integer[] := '{}';
  rec text;
begin
  if p_type = 'cloze' then
    for rec in
      select distinct (regexp_matches(coalesce(p_fields->>'text', ''), '\{\{c(\d+)::', 'g'))[1]
    loop
      result := array_append(result, rec::int - 1);
    end loop;
  end if;
  if coalesce(array_length(result, 1), 0) = 0 then
    result := array[0];
  end if;
  return result;
end;
$$;

create or replace function private.sync_note_cards(
  p_note_id uuid,
  p_deck_id uuid,
  p_owner_id uuid,
  p_type public.note_type,
  p_fields jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ords integer[];
begin
  v_ords := private.note_ords(p_type, p_fields);

  delete from public.cards
  where note_id = p_note_id
    and owner_id = p_owner_id
    and not (ord = any (v_ords));

  insert into public.cards (note_id, deck_id, owner_id, ord)
  select p_note_id, p_deck_id, p_owner_id, o
  from unnest(v_ords) as o
  where not exists (
    select 1 from public.cards c
    where c.note_id = p_note_id and c.ord = o
  );
end;
$$;

create or replace function private.save_note(
  p_note_id uuid,
  p_deck_id uuid,
  p_type public.note_type,
  p_fields jsonb,
  p_tags text[] default '{}',
  p_layout text default null,
  p_source jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  v_note_id uuid;
  v_layout text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.decks d where d.id = p_deck_id and d.owner_id = uid
  ) then
    raise exception 'deck not found';
  end if;

  v_layout := coalesce(p_layout, 'minimal');
  if v_layout not in ('minimal', 'emphasis', 'illustrated') then
    v_layout := 'minimal';
  end if;

  if p_note_id is null then
    insert into public.notes (deck_id, owner_id, type, fields, tags, layout, source)
    values (p_deck_id, uid, p_type, coalesce(p_fields, '{}'::jsonb), coalesce(p_tags, '{}'), v_layout, p_source)
    returning id into v_note_id;
  else
    update public.notes
    set
      type = p_type,
      fields = coalesce(p_fields, '{}'::jsonb),
      tags = coalesce(p_tags, '{}'),
      layout = case when p_layout is null then layout else v_layout end,
      source = case when p_source is null then source else p_source end
    where id = p_note_id and owner_id = uid
    returning id into v_note_id;
    if v_note_id is null then
      raise exception 'note not found';
    end if;
  end if;

  perform private.sync_note_cards(v_note_id, p_deck_id, uid, p_type, coalesce(p_fields, '{}'::jsonb));
  return v_note_id;
end;
$$;

create or replace function public.save_note(
  p_note_id uuid,
  p_deck_id uuid,
  p_type public.note_type,
  p_fields jsonb,
  p_tags text[] default '{}',
  p_layout text default null,
  p_source jsonb default null
)
returns uuid
language sql
security invoker
set search_path = public, private
as $$
  select private.save_note(p_note_id, p_deck_id, p_type, p_fields, p_tags, p_layout, p_source);
$$;

create or replace function private.import_ai_cards(p_job_id uuid, p_card_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  job public.ai_jobs%rowtype;
  card public.ai_cards%rowtype;
  v_deck_id uuid;
  v_note_id uuid;
  v_source jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into job from public.ai_jobs where id = p_job_id and owner_id = uid;
  if not found then
    raise exception 'job not found';
  end if;

  v_deck_id := job.deck_id;
  if v_deck_id is not null then
    if not exists (select 1 from public.decks where id = v_deck_id and owner_id = uid) then
      raise exception 'deck not found';
    end if;
  elsif coalesce(job.new_deck_name, '') <> '' then
    insert into public.decks (owner_id, name, icon, description)
    values (uid, job.new_deck_name, 'idea', '由 AI 制卡导入')
    returning id into v_deck_id;
    update public.ai_jobs set deck_id = v_deck_id where id = job.id;
  else
    raise exception 'missing deck';
  end if;

  for card in
    select * from public.ai_cards
    where job_id = p_job_id
      and owner_id = uid
      and id = any (p_card_ids)
      and status <> 'rejected'
    order by ord, id
  loop
    if card.note_id is not null then
      continue;
    end if;

    v_source := jsonb_build_object(
      'jobId', p_job_id,
      'citations', coalesce(card.sources, '[]'::jsonb)
    );

    insert into public.notes (deck_id, owner_id, type, fields, layout, source)
    values (v_deck_id, uid, card.type, card.fields, card.layout, v_source)
    returning id into v_note_id;

    perform private.sync_note_cards(v_note_id, v_deck_id, uid, card.type, card.fields);

    update public.ai_cards
    set note_id = v_note_id, status = 'imported'
    where id = card.id;
  end loop;

  update public.ai_jobs
  set status = 'imported'
  where id = p_job_id
    and owner_id = uid
    and exists (select 1 from public.ai_cards c where c.job_id = p_job_id and c.status = 'imported');

  return v_deck_id;
end;
$$;

create or replace function public.import_ai_cards(p_job_id uuid, p_card_ids uuid[])
returns uuid
language sql
security invoker
set search_path = public, private
as $$
  select private.import_ai_cards(p_job_id, p_card_ids);
$$;

grant execute on function private.note_ords(public.note_type, jsonb) to authenticated;
grant execute on function private.sync_note_cards(uuid, uuid, uuid, public.note_type, jsonb) to authenticated;
grant execute on function private.save_note(uuid, uuid, public.note_type, jsonb, text[], text, jsonb) to authenticated;
grant execute on function public.save_note(uuid, uuid, public.note_type, jsonb, text[], text, jsonb) to authenticated;
grant execute on function private.import_ai_cards(uuid, uuid[]) to authenticated;
grant execute on function public.import_ai_cards(uuid, uuid[]) to authenticated;
revoke execute on function public.save_note(uuid, uuid, public.note_type, jsonb, text[], text, jsonb) from anon, public;
revoke execute on function public.import_ai_cards(uuid, uuid[]) from anon, public;
