-- Agent 卡片接口：个人访问令牌，以及只按令牌或 auth.uid() 解析账号的读写函数。
-- 调用方不能传入别人的 owner_id。令牌原文只在创建时返回，库里只存哈希。

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null check (char_length(token_prefix) between 4 and 24),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index api_tokens_owner_active_idx on public.api_tokens (owner_id, created_at desc) where revoked_at is null;

create or replace function private.protect_api_token()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.token_hash is distinct from old.token_hash
     or new.token_prefix is distinct from old.token_prefix
     or new.created_at is distinct from old.created_at
  then
    raise exception 'api token is immutable';
  end if;
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'revoked api token cannot be restored';
  end if;
  return new;
end;
$$;

create trigger protect_api_token
  before update on public.api_tokens
  for each row execute function private.protect_api_token();

alter table public.api_tokens enable row level security;

create policy api_tokens_select_own on public.api_tokens
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy api_tokens_insert_own on public.api_tokens
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy api_tokens_update_own on public.api_tokens
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

revoke all on public.api_tokens from public, anon;
grant select, insert, update on public.api_tokens to authenticated;

create or replace function private.owner_from_api_token(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select owner_id into uid
  from public.api_tokens
  where token_hash = p_token_hash
    and revoked_at is null;

  return uid;
end;
$$;

create or replace function private.touch_api_token(p_token_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.api_tokens
  set last_used_at = now()
  where token_hash = p_token_hash
    and revoked_at is null;
end;
$$;

create or replace function private.save_note_for_owner(
  p_owner_id uuid,
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
  v_note_id uuid;
  v_layout text;
begin
  if p_owner_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.decks d where d.id = p_deck_id and d.owner_id = p_owner_id
  ) then
    raise exception 'deck not found';
  end if;

  v_layout := coalesce(p_layout, 'minimal');
  if v_layout not in ('minimal', 'emphasis', 'illustrated') then
    v_layout := 'minimal';
  end if;

  if p_note_id is null then
    insert into public.notes (deck_id, owner_id, type, fields, tags, layout, source)
    values (p_deck_id, p_owner_id, p_type, coalesce(p_fields, '{}'::jsonb), coalesce(p_tags, '{}'), v_layout, p_source)
    returning id into v_note_id;
  else
    update public.notes
    set
      type = p_type,
      fields = coalesce(p_fields, '{}'::jsonb),
      tags = coalesce(p_tags, '{}'),
      layout = case when p_layout is null then layout else v_layout end,
      source = case when p_source is null then source else p_source end
    where id = p_note_id and owner_id = p_owner_id
    returning id into v_note_id;
    if v_note_id is null then
      raise exception 'note not found';
    end if;
  end if;

  perform private.sync_note_cards(v_note_id, p_deck_id, p_owner_id, p_type, coalesce(p_fields, '{}'::jsonb));
  return v_note_id;
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
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  return private.save_note_for_owner(uid, p_note_id, p_deck_id, p_type, p_fields, p_tags, p_layout, p_source);
end;
$$;

create or replace function private.note_json(p_note_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', n.id,
    'owner_id', n.owner_id,
    'deck_id', n.deck_id,
    'deck_name', d.name,
    'type', n.type,
    'fields', n.fields,
    'tags', to_jsonb(n.tags),
    'layout', n.layout,
    'source', n.source,
    'created_at', n.created_at,
    'updated_at', n.updated_at
  )
  from public.notes n
  join public.decks d on d.id = n.deck_id and d.owner_id = n.owner_id
  where n.id = p_note_id;
$$;

create or replace function private.list_cards_for_owner(
  p_owner_id uuid,
  p_deck_id uuid,
  p_limit integer,
  p_cursor_updated timestamptz,
  p_cursor_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 51), 1), 101);
  result jsonb;
begin
  if p_owner_id is null then
    raise exception 'not authenticated';
  end if;
  if (p_cursor_updated is null) <> (p_cursor_id is null) then
    raise exception 'invalid cursor';
  end if;

  select coalesce(jsonb_agg(private.note_json(s.id) order by s.updated_at desc, s.id desc), '[]'::jsonb)
  into result
  from (
    select n.id, n.updated_at
    from public.notes n
    where n.owner_id = p_owner_id
      and (p_deck_id is null or n.deck_id = p_deck_id)
      and (
        p_cursor_updated is null
        or (n.updated_at, n.id) < (p_cursor_updated, p_cursor_id)
      )
    order by n.updated_at desc, n.id desc
    limit v_limit
  ) s;

  return result;
end;
$$;

create or replace function private.get_card_for_owner(p_owner_id uuid, p_note_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_owner_id is null then
    raise exception 'not authenticated';
  end if;

  select private.note_json(n.id) into result
  from public.notes n
  where n.id = p_note_id
    and n.owner_id = p_owner_id;

  return result;
end;
$$;

create or replace function private.save_card_for_owner(
  p_owner_id uuid,
  p_note_id uuid,
  p_deck_id uuid,
  p_type public.note_type,
  p_fields jsonb,
  p_tags text[],
  p_layout text,
  p_source jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from uuid;
  v_note_id uuid;
begin
  if p_owner_id is null then
    raise exception 'not authenticated';
  end if;

  if p_note_id is not null then
    select deck_id into v_from
    from public.notes
    where id = p_note_id and owner_id = p_owner_id
    for update;
    if not found then
      raise exception 'note not found';
    end if;
    if v_from is distinct from p_deck_id then
      if not exists (
        select 1 from public.decks where id = p_deck_id and owner_id = p_owner_id
      ) then
        raise exception 'deck not found';
      end if;
      update public.notes
      set deck_id = p_deck_id
      where id = p_note_id and owner_id = p_owner_id;
      update public.cards
      set deck_id = p_deck_id
      where note_id = p_note_id and owner_id = p_owner_id;
    end if;
  end if;

  v_note_id := private.save_note_for_owner(
    p_owner_id, p_note_id, p_deck_id, p_type, p_fields, p_tags, p_layout, p_source
  );
  return private.get_card_for_owner(p_owner_id, v_note_id);
end;
$$;

create or replace function public.list_own_cards(
  p_deck_id uuid default null,
  p_limit integer default 51,
  p_cursor_updated timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  return private.list_cards_for_owner(uid, p_deck_id, p_limit, p_cursor_updated, p_cursor_id);
end;
$$;

create or replace function public.get_own_card(p_note_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  return private.get_card_for_owner(uid, p_note_id);
end;
$$;

create or replace function public.save_own_card(
  p_note_id uuid,
  p_deck_id uuid,
  p_type public.note_type,
  p_fields jsonb,
  p_tags text[] default '{}',
  p_layout text default null,
  p_source jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  return private.save_card_for_owner(uid, p_note_id, p_deck_id, p_type, p_fields, p_tags, p_layout, p_source);
end;
$$;

create or replace function public.agent_list_cards(
  p_token_hash text,
  p_deck_id uuid default null,
  p_limit integer default 51,
  p_cursor_updated timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not authenticated';
  end if;
  uid := private.owner_from_api_token(p_token_hash);
  if uid is null then
    raise exception 'not authenticated';
  end if;
  perform private.touch_api_token(p_token_hash);
  return private.list_cards_for_owner(uid, p_deck_id, p_limit, p_cursor_updated, p_cursor_id);
end;
$$;

create or replace function public.agent_get_card(p_token_hash text, p_note_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not authenticated';
  end if;
  uid := private.owner_from_api_token(p_token_hash);
  if uid is null then
    raise exception 'not authenticated';
  end if;
  perform private.touch_api_token(p_token_hash);
  return private.get_card_for_owner(uid, p_note_id);
end;
$$;

create or replace function public.agent_save_card(
  p_token_hash text,
  p_note_id uuid,
  p_deck_id uuid,
  p_type public.note_type,
  p_fields jsonb,
  p_tags text[] default '{}',
  p_layout text default null,
  p_source jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not authenticated';
  end if;
  uid := private.owner_from_api_token(p_token_hash);
  if uid is null then
    raise exception 'not authenticated';
  end if;
  perform private.touch_api_token(p_token_hash);
  return private.save_card_for_owner(uid, p_note_id, p_deck_id, p_type, p_fields, p_tags, p_layout, p_source);
end;
$$;

revoke all on function private.protect_api_token() from public, anon, authenticated;
revoke all on function private.owner_from_api_token(text) from public, anon, authenticated;
revoke all on function private.touch_api_token(text) from public, anon, authenticated;

create or replace function public.agent_token_owner(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not authenticated';
  end if;
  return private.owner_from_api_token(p_token_hash);
end;
$$;

revoke all on function public.agent_token_owner(text) from public, anon, authenticated;
revoke all on function private.save_note_for_owner(uuid, uuid, uuid, public.note_type, jsonb, text[], text, jsonb) from public, anon, authenticated;
revoke all on function private.note_json(uuid) from public, anon, authenticated;
revoke all on function private.list_cards_for_owner(uuid, uuid, integer, timestamptz, uuid) from public, anon, authenticated;
revoke all on function private.get_card_for_owner(uuid, uuid) from public, anon, authenticated;
revoke all on function private.save_card_for_owner(uuid, uuid, uuid, public.note_type, jsonb, text[], text, jsonb) from public, anon, authenticated;

revoke all on function public.list_own_cards(uuid, integer, timestamptz, uuid) from public, anon;
revoke all on function public.get_own_card(uuid) from public, anon;
revoke all on function public.save_own_card(uuid, uuid, public.note_type, jsonb, text[], text, jsonb) from public, anon;
grant execute on function public.list_own_cards(uuid, integer, timestamptz, uuid) to authenticated;
grant execute on function public.get_own_card(uuid) to authenticated;
grant execute on function public.save_own_card(uuid, uuid, public.note_type, jsonb, text[], text, jsonb) to authenticated;

revoke all on function public.agent_list_cards(text, uuid, integer, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.agent_get_card(text, uuid) from public, anon, authenticated;
revoke all on function public.agent_save_card(text, uuid, uuid, public.note_type, jsonb, text[], text, jsonb) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.agent_token_owner(text) to service_role;
    grant execute on function public.agent_list_cards(text, uuid, integer, timestamptz, uuid) to service_role;
    grant execute on function public.agent_get_card(text, uuid) to service_role;
    grant execute on function public.agent_save_card(text, uuid, uuid, public.note_type, jsonb, text[], text, jsonb) to service_role;
  end if;
end;
$$;
