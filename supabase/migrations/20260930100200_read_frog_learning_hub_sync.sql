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
       or (v_item->>'type') not in ('note', 'qa', 'choice', 'cloze', 'poem', 'vocab', 'dict', 'sentence', 'writing')
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

revoke all on function public.learning_hub_sync(text, jsonb) from public, anon, authenticated;
grant execute on function public.learning_hub_sync(text, jsonb) to anon, authenticated;
