-- Deck-scoped bearer tokens and atomic, non-destructive Learning Hub sync.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table private.learning_hub_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text not null check (length(btrim(label)) between 1 and 80),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index learning_hub_tokens_owner_idx
  on private.learning_hub_tokens(owner_id, created_at desc);

create table private.learning_hub_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  external_id text not null check (length(btrim(external_id)) between 1 and 300),
  note_id uuid unique references public.notes(id) on delete set null,
  version bigint not null check (version > 0),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  source text not null,
  snapshot_type public.note_type not null,
  snapshot_fields jsonb not null,
  snapshot_tags text[] not null,
  snapshot_note_source jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, deck_id, external_id)
);

create index learning_hub_notes_deck_idx
  on private.learning_hub_notes(owner_id, deck_id, external_id);

alter table private.learning_hub_tokens enable row level security;
alter table private.learning_hub_notes enable row level security;
revoke all on private.learning_hub_tokens from public, anon, authenticated;
revoke all on private.learning_hub_notes from public, anon, authenticated;

create or replace function private.learning_hub_only_keys(p_value jsonb, p_keys text[])
returns boolean
language sql
immutable
  set search_path = public, private, extensions, pg_temp
as $$
  select case when jsonb_typeof(p_value) is distinct from 'object' then false else not exists (
      select 1
      from jsonb_object_keys(p_value) as keys(key_name)
      where not (key_name = any(p_keys))
    ) end;
$$;

create or replace function private.learning_hub_validate_fields(p_type text, p_fields jsonb)
returns integer[]
language plpgsql
immutable
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_pair record;
  v_option jsonb;
  v_key text;
  v_answer text;
  v_text text;
  v_start_count integer;
  v_valid_count integer;
  v_id integer;
  v_option_keys text[] := '{}';
begin
  if p_fields is null or jsonb_typeof(p_fields) is distinct from 'object' then
    raise exception 'invalid learning hub fields' using errcode = '22023';
  end if;

  if p_type = 'note' then
    if not private.learning_hub_only_keys(p_fields, array['title', 'body']) then
      raise exception 'invalid note fields' using errcode = '22023';
    end if;
    for v_pair in select key_name, value from jsonb_each(p_fields) as f(key_name, value) loop
      if jsonb_typeof(v_pair.value) <> 'string' or length(v_pair.value #>> '{}') > 500000 then
        raise exception 'invalid note text' using errcode = '22023';
      end if;
    end loop;
    if length(btrim(coalesce(p_fields->>'title', ''))) = 0
       and length(btrim(coalesce(p_fields->>'body', ''))) = 0 then
      raise exception 'note requires a title or body' using errcode = '22023';
    end if;
    return array[0];
  elsif p_type = 'qa' then
    if not private.learning_hub_only_keys(p_fields, array['question', 'answer'])
       or jsonb_typeof(p_fields->'question') <> 'string'
       or jsonb_typeof(p_fields->'answer') <> 'string'
       or length(btrim(coalesce(p_fields->>'question', ''))) = 0
       or length(btrim(coalesce(p_fields->>'answer', ''))) = 0
       or length(p_fields->>'question') > 500000
       or length(p_fields->>'answer') > 500000 then
      raise exception 'invalid qa fields' using errcode = '22023';
    end if;
    return array[0];
  elsif p_type = 'choice' then
    if not private.learning_hub_only_keys(p_fields, array['stem', 'options', 'answer', 'explain'])
       or jsonb_typeof(p_fields->'stem') is distinct from 'string'
       or length(btrim(coalesce(p_fields->>'stem', ''))) = 0
       or length(p_fields->>'stem') > 500000
       or jsonb_typeof(p_fields->'options') is distinct from 'array'
       or jsonb_array_length(p_fields->'options') not between 2 and 6
       or jsonb_typeof(p_fields->'answer') is distinct from 'string'
       or length(p_fields->>'answer') <> 1
       or (p_fields->>'answer') !~ '^[A-F]$'
       or (p_fields ? 'explain' and (jsonb_typeof(p_fields->'explain') <> 'string' or length(p_fields->>'explain') > 500000)) then
      raise exception 'invalid choice fields' using errcode = '22023';
    end if;
    for v_option in select value from jsonb_array_elements(p_fields->'options') as options(value) loop
      if not private.learning_hub_only_keys(v_option, array['key', 'text'])
         or jsonb_typeof(v_option->'key') <> 'string'
         or jsonb_typeof(v_option->'text') <> 'string'
         or (v_option->>'key') !~ '^[A-F]$'
         or length(btrim(coalesce(v_option->>'text', ''))) = 0
         or length(v_option->>'text') > 20000 then
        raise exception 'invalid choice option' using errcode = '22023';
      end if;
      v_key := v_option->>'key';
      if v_key = any(v_option_keys) then
        raise exception 'duplicate choice option key' using errcode = '22023';
      end if;
      v_option_keys := array_append(v_option_keys, v_key);
    end loop;
    if not (p_fields->>'answer' = any(v_option_keys)) then
      raise exception 'choice answer does not match an option' using errcode = '22023';
    end if;
    return array[0];
  elsif p_type = 'cloze' then
    if not private.learning_hub_only_keys(p_fields, array['text'])
       or jsonb_typeof(p_fields->'text') is distinct from 'string'
       or length(btrim(coalesce(p_fields->>'text', ''))) = 0
       or length(p_fields->>'text') > 500000 then
      raise exception 'invalid cloze fields' using errcode = '22023';
    end if;
    v_text := p_fields->>'text';
    select count(*) into v_start_count
      from regexp_matches(v_text, '\{\{c[0-9]+::', 'g');
    select count(*) into v_valid_count
      from regexp_matches(v_text, '\{\{c([1-9][0-9]*)::[^{}]+(?:::[^{}]*)?\}\}', 'g');
    if v_start_count = 0 or v_start_count <> v_valid_count then
      raise exception 'invalid cloze markup' using errcode = '22023';
    end if;
    for v_pair in
      select (match)[1] as id_text
      from regexp_matches(v_text, '\{\{c([1-9][0-9]*)::[^{}]+(?:::[^{}]*)?\}\}', 'g') as matches(match)
    loop
      v_id := v_pair.id_text::integer;
      if v_id > 100 then
        raise exception 'too many cloze ordinals' using errcode = '22023';
      end if;
    end loop;
    return private.note_ords(p_type::public.note_type, p_fields);
  elsif p_type = 'poem' then
    if not private.learning_hub_only_keys(p_fields, array['title', 'author', 'original', 'translation'])
       or jsonb_typeof(p_fields->'original') is distinct from 'string'
       or length(btrim(coalesce(p_fields->>'original', ''))) = 0 then
      raise exception 'invalid poem fields' using errcode = '22023';
    end if;
    for v_pair in select key_name, value from jsonb_each(p_fields) as f(key_name, value) loop
      if jsonb_typeof(v_pair.value) <> 'string' or length(v_pair.value #>> '{}') > 500000 then
        raise exception 'invalid poem text' using errcode = '22023';
      end if;
    end loop;
    return array[0];
  elsif p_type = 'vocab' then
    if not private.learning_hub_only_keys(p_fields, array['word', 'phonetic', 'meaning', 'example'])
       or jsonb_typeof(p_fields->'word') is distinct from 'string'
       or jsonb_typeof(p_fields->'meaning') is distinct from 'string'
       or length(btrim(coalesce(p_fields->>'word', ''))) = 0
       or length(btrim(coalesce(p_fields->>'meaning', ''))) = 0 then
      raise exception 'invalid vocab fields' using errcode = '22023';
    end if;
    for v_pair in select key_name, value from jsonb_each(p_fields) as f(key_name, value) loop
      if jsonb_typeof(v_pair.value) <> 'string' or length(v_pair.value #>> '{}') > 500000 then
        raise exception 'invalid vocab text' using errcode = '22023';
      end if;
    end loop;
    return array[0];
  end if;

  raise exception 'unsupported learning hub note type' using errcode = '22023';
end;
$$;

create or replace function public.learning_hub_create_token(
  p_deck_id uuid,
  p_token_hash text,
  p_label text
)
returns uuid
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_token_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid token hash' using errcode = '22023';
  end if;
  if p_label is null or length(btrim(p_label)) not between 1 and 80 then
    raise exception 'invalid integration label' using errcode = '22023';
  end if;
  if not exists (select 1 from public.decks d where d.id = p_deck_id and d.owner_id = v_uid) then
    raise exception 'deck not found' using errcode = '42501';
  end if;

  insert into private.learning_hub_tokens(owner_id, deck_id, token_hash, label)
  values (v_uid, p_deck_id, p_token_hash, btrim(p_label))
  returning id into v_token_id;
  return v_token_id;
end;
$$;

create or replace function public.learning_hub_list_tokens()
returns table (
  id uuid,
  deck_id uuid,
  deck_name text,
  label text,
  created_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
)
language sql
security definer
set search_path = public, private, extensions, pg_temp
as $$
  select t.id, t.deck_id, d.name, t.label, t.created_at, t.last_used_at, t.revoked_at
  from private.learning_hub_tokens t
  join public.decks d on d.id = t.deck_id and d.owner_id = t.owner_id
  where t.owner_id = auth.uid()
  order by t.created_at desc;
$$;

create or replace function public.learning_hub_revoke_token(p_token_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  update private.learning_hub_tokens
  set revoked_at = coalesce(revoked_at, clock_timestamp())
  where id = p_token_id and owner_id = v_uid
  returning id into v_id;
  return v_id is not null;
end;
$$;

create or replace function public.learning_hub_sync(p_token text, p_notes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_token private.learning_hub_tokens%rowtype;
  v_uid uuid;
  v_deck_id uuid;
  v_item jsonb;
  v_external_id text;
  v_version numeric;
  v_type public.note_type;
  v_fields jsonb;
  v_tags text[];
  v_source text;
  v_hash text;
  v_note_source jsonb;
  v_new_ords integer[];
  v_map private.learning_hub_notes%rowtype;
  v_note public.notes%rowtype;
  v_status text;
  v_results jsonb := '[]'::jsonb;
  v_response_version bigint;
  v_payload_same boolean;
  v_item_count integer;
  v_unique_count integer;
begin
  if p_token is null or p_token !~ '^vji_live_[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid or revoked integration token' using errcode = '28000';
  end if;
  select * into v_token
  from private.learning_hub_tokens t
  where t.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and t.revoked_at is null
  for update;
  if not found then raise exception 'invalid or revoked integration token' using errcode = '28000'; end if;

  v_uid := v_token.owner_id;
  v_deck_id := v_token.deck_id;
  if not exists (select 1 from public.decks d where d.id = v_deck_id and d.owner_id = v_uid) then
    raise exception 'integration deck is no longer available' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || v_deck_id::text, 0));
  update private.learning_hub_tokens set last_used_at = clock_timestamp() where id = v_token.id;

  if p_notes is null or jsonb_typeof(p_notes) <> 'array' then
    raise exception 'p_notes must be an array' using errcode = '22023';
  end if;
  v_item_count := jsonb_array_length(p_notes);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'batch must contain 1 to 50 notes' using errcode = '22023';
  end if;
  if octet_length(p_notes::text) > 2200000 then
    raise exception 'batch payload exceeds the 2 MiB request limit' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_notes) as items(value) loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or not private.learning_hub_only_keys(v_item, array['external_id', 'version', 'type', 'fields', 'tags', 'source', 'content_hash'])
       or jsonb_typeof(v_item->'external_id') is distinct from 'string'
       or length(btrim(coalesce(v_item->>'external_id', ''))) not between 1 and 300
       or jsonb_typeof(v_item->'version') is distinct from 'number'
       or (v_item->>'version')::numeric < 1
       or (v_item->>'version')::numeric > 2147483647
       or trunc((v_item->>'version')::numeric) <> (v_item->>'version')::numeric
       or jsonb_typeof(v_item->'type') is distinct from 'string'
       or (v_item->>'type') not in ('note', 'qa', 'choice', 'cloze', 'poem', 'vocab')
       or jsonb_typeof(v_item->'tags') is distinct from 'array'
       or jsonb_array_length(v_item->'tags') > 50
       or jsonb_typeof(v_item->'source') is distinct from 'string'
       or length(v_item->>'source') not between 1 and 8192
       or jsonb_typeof(v_item->'content_hash') is distinct from 'string'
       or (v_item->>'content_hash') !~ '^[0-9a-f]{64}$' then
      raise exception 'invalid learning hub note payload' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_item->'tags') as tags(value)
      where jsonb_typeof(value) is distinct from 'string'
         or coalesce(length(btrim(value #>> '{}')), 0) not between 1 and 100
    ) then
      raise exception 'invalid learning hub tags' using errcode = '22023';
    end if;
    perform private.learning_hub_validate_fields(v_item->>'type', v_item->'fields');
  end loop;

  select count(distinct value->>'external_id') into v_unique_count
  from jsonb_array_elements(p_notes) as items(value);
  if v_unique_count <> v_item_count then
    raise exception 'external_id must be unique within a batch' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_notes) as items(value) loop
    v_external_id := v_item->>'external_id';
    v_version := (v_item->>'version')::numeric;
    v_type := (v_item->>'type')::public.note_type;
    v_fields := v_item->'fields';
    select coalesce(array_agg(value #>> '{}' order by ordinality), '{}'::text[])
      into v_tags
      from jsonb_array_elements(v_item->'tags') with ordinality as tags(value, ordinality);
    v_source := v_item->>'source';
    v_hash := v_item->>'content_hash';
    v_note_source := jsonb_build_object(
      'provider', 'learning_hub',
      'external_id', v_external_id,
      'source', v_source
    );
    v_new_ords := private.learning_hub_validate_fields(v_type::text, v_fields);

    select * into v_map
    from private.learning_hub_notes m
    where m.owner_id = v_uid and m.deck_id = v_deck_id and m.external_id = v_external_id
    for update;

    if not found then
      insert into public.notes(deck_id, owner_id, type, fields, tags, layout, source)
      values (v_deck_id, v_uid, v_type, v_fields, v_tags, 'minimal', v_note_source)
      returning * into v_note;

      insert into public.cards(note_id, deck_id, owner_id, ord)
      select v_note.id, v_deck_id, v_uid, ord
      from unnest(v_new_ords) as ordinals(ord);

      insert into private.learning_hub_notes(
        owner_id, deck_id, external_id, note_id, version, content_hash, source,
        snapshot_type, snapshot_fields, snapshot_tags, snapshot_note_source
      ) values (
        v_uid, v_deck_id, v_external_id, v_note.id, v_version::bigint, v_hash, v_source,
        v_type, v_fields, v_tags, v_note_source
      );
      v_status := 'created';
      v_response_version := v_version::bigint;
    else
      if v_map.note_id is null then
        raise exception 'mapped note was deleted locally; the external_id is tombstoned' using errcode = '40001';
      end if;
      select * into v_note
      from public.notes n
      where n.id = v_map.note_id and n.owner_id = v_uid and n.deck_id = v_deck_id
      for update;
      if not found then
        raise exception 'mapped note ownership or deck mismatch' using errcode = '42501';
      end if;
      if v_note.type is distinct from v_map.snapshot_type
         or v_note.fields is distinct from v_map.snapshot_fields
         or v_note.tags is distinct from v_map.snapshot_tags
         or v_note.source is distinct from v_map.snapshot_note_source then
        raise exception 'integration note was edited in V Ji; resolve the local edit before syncing' using errcode = '40001';
      end if;

      v_payload_same := v_map.snapshot_type = v_type
        and v_map.snapshot_fields = v_fields
        and v_map.snapshot_tags = v_tags
        and v_map.source = v_source;

      if v_version <= v_map.version then
        if not v_payload_same or v_hash is distinct from v_map.content_hash then
          raise exception 'learning hub version conflict for external_id %', v_external_id using errcode = '40001';
        end if;
        v_status := 'unchanged';
        v_response_version := v_map.version;
      elsif v_payload_same then
        if v_hash is distinct from v_map.content_hash then
          raise exception 'content_hash changed without a payload change' using errcode = '22023';
        end if;
        update private.learning_hub_notes
        set version = v_version::bigint,
            content_hash = v_hash,
            updated_at = clock_timestamp()
        where id = v_map.id;
        v_status := 'unchanged';
        v_response_version := v_version::bigint;
      else
        if v_hash = v_map.content_hash then
          raise exception 'content_hash reused for a different payload' using errcode = '22023';
        end if;
        if exists (
          select 1 from public.cards c
          where c.note_id = v_note.id and not (c.ord = any(v_new_ords))
        ) then
          raise exception 'update would remove existing card ordinals' using errcode = '40001';
        end if;
        if v_note.type is distinct from v_type and exists (
          select 1 from public.cards c
          where c.note_id = v_note.id
            and (c.reps > 0 or c.lapses > 0 or c.state <> 0 or c.last_review is not null
                 or exists (select 1 from public.review_logs rl where rl.card_id = c.id))
        ) then
          raise exception 'cannot change card type after review history exists' using errcode = '40001';
        end if;

        update public.notes
        set type = v_type, fields = v_fields, tags = v_tags, source = v_note_source, updated_at = clock_timestamp()
        where id = v_note.id and owner_id = v_uid and deck_id = v_deck_id;

        insert into public.cards(note_id, deck_id, owner_id, ord)
        select v_note.id, v_deck_id, v_uid, ord
        from unnest(v_new_ords) as ordinals(ord)
        where not exists (
          select 1 from public.cards c where c.note_id = v_note.id and c.ord = ord
        );

        update private.learning_hub_notes
        set version = v_version::bigint,
            content_hash = v_hash,
            source = v_source,
            snapshot_type = v_type,
            snapshot_fields = v_fields,
            snapshot_tags = v_tags,
            snapshot_note_source = v_note_source,
            updated_at = clock_timestamp()
        where id = v_map.id;
        v_status := 'updated';
        v_response_version := v_version::bigint;
      end if;
    end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'external_id', v_external_id,
      'note_id', case when v_status = 'created' then v_note.id else v_map.note_id end,
      'deck_id', v_deck_id,
      'status', v_status,
      'version', v_response_version
    ));
  end loop;

  return v_results;
end;
$$;

create or replace function public.learning_hub_status(
  p_token text,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_token private.learning_hub_tokens%rowtype;
  v_deck public.decks%rowtype;
  v_notes jsonb;
  v_total bigint;
begin
  if p_token is null or p_token !~ '^vji_live_[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid or revoked integration token' using errcode = '28000';
  end if;
  if p_limit is null or p_limit not between 1 and 500 or p_offset is null or p_offset < 0 then
    raise exception 'invalid progress page' using errcode = '22023';
  end if;
  select * into v_token
  from private.learning_hub_tokens t
  where t.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and t.revoked_at is null;
  if not found then raise exception 'invalid or revoked integration token' using errcode = '28000'; end if;
  select * into v_deck from public.decks d where d.id = v_token.deck_id and d.owner_id = v_token.owner_id;
  if not found then raise exception 'integration deck is no longer available' using errcode = '42501'; end if;

  select count(*) into v_total
  from private.learning_hub_notes m
  join public.notes n on n.id = m.note_id and n.owner_id = v_token.owner_id and n.deck_id = v_token.deck_id
  where m.owner_id = v_token.owner_id and m.deck_id = v_token.deck_id;

  select coalesce(jsonb_agg(to_jsonb(page) order by page.external_id), '[]'::jsonb) into v_notes
  from (
    select m.external_id,
           m.note_id,
           count(c.id)::integer as card_count,
           (count(c.id) filter (where c.suspended = false and c.due <= statement_timestamp()))::integer as due_count,
           coalesce(sum(c.reps), 0)::bigint as total_reps,
           max(c.last_review) as last_reviewed_at
    from private.learning_hub_notes m
    join public.notes n on n.id = m.note_id and n.owner_id = v_token.owner_id and n.deck_id = v_token.deck_id
    left join public.cards c on c.note_id = n.id and c.owner_id = v_token.owner_id and c.deck_id = v_token.deck_id
    where m.owner_id = v_token.owner_id and m.deck_id = v_token.deck_id
    group by m.external_id, m.note_id
    order by m.external_id
    limit p_limit offset p_offset
  ) as page;

  return jsonb_build_object(
    'deck_id', v_deck.id,
    'deck_name', v_deck.name,
    'notes', v_notes,
    'total', v_total,
    'next_offset', case when p_offset + p_limit < v_total then p_offset + p_limit else null end
  );
end;
$$;

revoke all on function private.learning_hub_only_keys(jsonb, text[]) from public, anon, authenticated;
revoke all on function private.learning_hub_validate_fields(text, jsonb) from public, anon, authenticated;
revoke all on function public.learning_hub_create_token(uuid, text, text) from public, anon, authenticated;
revoke all on function public.learning_hub_list_tokens() from public, anon, authenticated;
revoke all on function public.learning_hub_revoke_token(uuid) from public, anon, authenticated;
revoke all on function public.learning_hub_sync(text, jsonb) from public, anon, authenticated;
revoke all on function public.learning_hub_status(text, integer, integer) from public, anon, authenticated;

grant execute on function public.learning_hub_create_token(uuid, text, text) to authenticated;
grant execute on function public.learning_hub_list_tokens() to authenticated;
grant execute on function public.learning_hub_revoke_token(uuid) to authenticated;
grant execute on function public.learning_hub_sync(text, jsonb) to anon, authenticated;
grant execute on function public.learning_hub_status(text, integer, integer) to anon, authenticated;
