-- Run as the database owner after applying migrations; all fixtures roll back.
begin;
do $$
<<learning_hub_check>>
declare
  first_user uuid := gen_random_uuid();
  second_user uuid := gen_random_uuid();
  first_deck uuid;
  second_deck uuid;
  foreign_deck uuid;
  token_text text := 'vji_live_' || repeat('A', 43);
  token_hash_value text := encode(extensions.digest('vji_live_' || repeat('A', 43), 'sha256'), 'hex');
  token_id uuid;
  qa_note_id uuid;
  note_id uuid;
  card_id uuid;
  result jsonb;
  progress jsonb;
  last_used timestamptz;
  review_count integer;
  actual integer;
begin
  insert into auth.users(id, email) values
    (first_user, first_user || '@learning-hub-check.invalid'),
    (second_user, second_user || '@learning-hub-check.invalid');
  insert into public.decks(owner_id, name) values (first_user, 'Hub destination') returning id into first_deck;
  insert into public.decks(owner_id, name) values (first_user, 'Other owned deck') returning id into second_deck;
  insert into public.decks(owner_id, name) values (second_user, 'Other user deck') returning id into foreign_deck;

  perform set_config('request.jwt.claim.sub', second_user::text, true);
  begin
    perform public.learning_hub_create_token(first_deck, token_hash_value, 'Should fail');
    raise exception 'expected owner check for token creation' using errcode = 'P0001';
  exception when insufficient_privilege then
    null;
  end;

  perform set_config('request.jwt.claim.sub', first_user::text, true);
  token_id := public.learning_hub_create_token(first_deck, token_hash_value, 'Regression token');
  if not exists (
    select 1 from private.learning_hub_tokens t
    where t.id = token_id and t.owner_id = first_user and t.deck_id = first_deck
      and t.token_hash = token_hash_value and t.token_hash <> token_text
  ) then
    raise exception 'token scope/hash was not stored as expected';
  end if;
  select count(*) into actual from public.learning_hub_list_tokens();
  if actual <> 1 then raise exception 'user token listing leaked or missed rows: %', actual; end if;

  begin
    perform public.learning_hub_sync(token_text, jsonb_build_array(
      jsonb_build_object(
        'external_id', 'lesson:atomic-valid', 'version', 1, 'type', 'qa',
        'fields', jsonb_build_object('question', 'Valid first item', 'answer', 'Will roll back'),
        'tags', jsonb_build_array(), 'source', 'atomic.md', 'content_hash', repeat('0', 64)
      ),
      jsonb_build_object(
        'external_id', 'lesson:atomic-invalid', 'version', 1, 'type', 'qa',
        'fields', jsonb_build_object('question', 'Missing answer'),
        'tags', jsonb_build_array(), 'source', 'atomic.md', 'content_hash', repeat('0', 64)
      )
    ));
    raise exception 'expected the invalid batch item to abort the batch' using errcode = 'P0001';
  exception when invalid_parameter_value then
    null;
  end;
  if exists (select 1 from private.learning_hub_notes where external_id like 'lesson:atomic-%') then
    raise exception 'an invalid batch partially committed a note';
  end if;

  result := public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
    'external_id', 'lesson:42', 'version', 1, 'type', 'qa',
    'fields', jsonb_build_object('question', 'What is a closure?', 'answer', 'A lexical scope.'),
    'tags', jsonb_build_array('javascript'), 'source', 'lesson-42.md', 'content_hash', repeat('1', 64)
  )));
  if result->0->>'status' <> 'created' or result->0->>'deck_id' <> first_deck::text then
    raise exception 'first sync was not created inside the token deck: %', result;
  end if;
  note_id := (result->0->>'note_id')::uuid;
  qa_note_id := note_id;
  select c.id into strict card_id from public.cards c where c.note_id = learning_hub_check.note_id and c.ord = 0;

  result := public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
    'external_id', 'lesson:42', 'version', 1, 'type', 'qa',
    'fields', jsonb_build_object('question', 'What is a closure?', 'answer', 'A lexical scope.'),
    'tags', jsonb_build_array('javascript'), 'source', 'lesson-42.md', 'content_hash', repeat('1', 64)
  )));
  if result->0->>'status' <> 'unchanged' or result->0->>'note_id' <> note_id::text then
    raise exception 'identical replay was not idempotent: %', result;
  end if;

  begin
    perform public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
      'external_id', 'lesson:42', 'version', 1, 'type', 'qa',
      'fields', jsonb_build_object('question', 'Changed under the same version', 'answer', 'Different'),
      'tags', jsonb_build_array('javascript'), 'source', 'lesson-42.md', 'content_hash', repeat('1', 64)
    )));
    raise exception 'expected same-version payload conflict' using errcode = 'P0001';
  exception when serialization_failure then
    null;
  end;

  update public.cards
  set reps = 4, lapses = 1, state = 2, stability = 3.5, due = now() - interval '1 minute', last_review = now() - interval '1 hour'
  where id = card_id;
  insert into public.review_logs(card_id, owner_id, rating, state, due, review_at, duration_ms)
  values (card_id, first_user, 3, 2, now() - interval '1 minute', now() - interval '1 hour', 1500);

  result := public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
    'external_id', 'lesson:42', 'version', 2, 'type', 'qa',
    'fields', jsonb_build_object('question', 'What is a closure?', 'answer', 'A function plus its lexical environment.'),
    'tags', jsonb_build_array('javascript'), 'source', 'lesson-42.md', 'content_hash', repeat('2', 64)
  )));
  if result->0->>'status' <> 'updated' or result->0->>'note_id' <> note_id::text then
    raise exception 'new version did not update the mapped note: %', result;
  end if;
  if not exists (select 1 from public.cards c where c.id = learning_hub_check.card_id and c.note_id = learning_hub_check.note_id and c.reps = 4 and c.lapses = 1 and c.state = 2) then
    raise exception 'reviewed card identity or scheduling progress was not retained';
  end if;
  select count(*) into review_count from public.review_logs rl where rl.card_id = learning_hub_check.card_id;
  if review_count <> 1 then raise exception 'review history changed during import update: %', review_count; end if;

  select last_used_at into last_used from private.learning_hub_tokens where id = token_id;
  progress := public.learning_hub_status(token_text, 100, 0);
  if (select last_used_at from private.learning_hub_tokens where id = token_id) is distinct from last_used then
    raise exception 'read-only progress updated token usage state';
  end if;
  if progress->>'deck_id' <> first_deck::text
     or progress #>> '{notes,0,note_id}' <> note_id::text
     or (progress #>> '{notes,0,card_count}')::integer <> 1
     or (progress #>> '{notes,0,due_count}')::integer <> 1
     or (progress #>> '{notes,0,total_reps}')::integer <> 4
     or progress #>> '{notes,0,last_reviewed_at}' is null then
    raise exception 'read-only progress did not return the reviewed card state: %', progress;
  end if;

  begin
    perform public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
      'external_id', 'lesson:42', 'version', 3, 'type', 'qa',
      'fields', jsonb_build_object('question', 'Changed but hash was reused', 'answer', 'Different'),
      'tags', jsonb_build_array('javascript'), 'source', 'lesson-42.md', 'content_hash', repeat('2', 64)
    )));
    raise exception 'expected content hash reuse rejection' using errcode = 'P0001';
  exception when data_exception then
    null;
  end;

  begin
    perform public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
      'external_id', 'lesson:42', 'version', 1, 'type', 'qa',
      'fields', jsonb_build_object('question', 'Stale content', 'answer', 'Old'),
      'tags', jsonb_build_array('javascript'), 'source', 'lesson-42.md', 'content_hash', repeat('3', 64)
    )));
    raise exception 'expected stale-version conflict' using errcode = 'P0001';
  exception when serialization_failure then
    null;
  end;

  update public.notes set fields = jsonb_build_object('question', 'Manual local edit', 'answer', 'Keep this')
  where id = note_id and owner_id = first_user;
  begin
    perform public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
      'external_id', 'lesson:42', 'version', 3, 'type', 'qa',
      'fields', jsonb_build_object('question', 'Hub overwrite attempt', 'answer', 'No'),
      'tags', jsonb_build_array('javascript'), 'source', 'lesson-42.md', 'content_hash', repeat('4', 64)
    )));
    raise exception 'expected local-edit conflict' using errcode = 'P0001';
  exception when serialization_failure then
    null;
  end;
  update public.notes set fields = jsonb_build_object('question', 'What is a closure?', 'answer', 'A function plus its lexical environment.')
  where id = note_id and owner_id = first_user;

  result := public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
    'external_id', 'lesson:cloze', 'version', 1, 'type', 'cloze',
    'fields', jsonb_build_object('text', '{{c1::one}} and {{c2::two}}'),
    'tags', jsonb_build_array(), 'source', 'cloze.md', 'content_hash', repeat('5', 64)
  )));
  note_id := (result->0->>'note_id')::uuid;
  begin
    perform public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
      'external_id', 'lesson:cloze', 'version', 2, 'type', 'cloze',
      'fields', jsonb_build_object('text', '{{c1::one}}'),
      'tags', jsonb_build_array(), 'source', 'cloze.md', 'content_hash', repeat('6', 64)
    )));
    raise exception 'expected ordinal removal rejection' using errcode = 'P0001';
  exception when serialization_failure then
    null;
  end;
  select count(*) into actual from public.cards c where c.note_id = learning_hub_check.note_id;
  if actual <> 2 then raise exception 'rejected cloze edit removed an existing card ordinal: %', actual; end if;

  progress := public.learning_hub_status(token_text, 1, 0);
  if (progress->>'total')::integer <> 2 or (progress->>'next_offset')::integer <> 1
     or progress #>> '{notes,0,external_id}' <> 'lesson:42' then
    raise exception 'progress pagination did not return the first page: %', progress;
  end if;
  progress := public.learning_hub_status(token_text, 1, 1);
  if progress #>> '{notes,0,external_id}' <> 'lesson:cloze' then
    raise exception 'progress pagination did not return the next page: %', progress;
  end if;

  begin
    perform public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
      'external_id', 'lesson:42', 'version', 3, 'type', 'choice',
      'fields', jsonb_build_object('stem', 'Pick one', 'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', 'One'), jsonb_build_object('key', 'B', 'text', 'Two')), 'answer', 'A'),
      'tags', jsonb_build_array('javascript'), 'source', 'lesson-42.md', 'content_hash', repeat('7', 64)
    )));
    raise exception 'expected reviewed type-change rejection' using errcode = 'P0001';
  exception when serialization_failure then
    null;
  end;

  update public.notes set deck_id = second_deck where id = note_id and owner_id = first_user;
  begin
    perform public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
      'external_id', 'lesson:cloze', 'version', 2, 'type', 'cloze',
      'fields', jsonb_build_object('text', '{{c1::one}} and {{c2::two}}'),
      'tags', jsonb_build_array(), 'source', 'cloze.md', 'content_hash', repeat('5', 64)
    )));
    raise exception 'expected mapped-deck ownership check' using errcode = 'P0001';
  exception when insufficient_privilege then
    null;
  end;
  progress := public.learning_hub_status(token_text, 100, 0);
  if (progress->>'total')::integer <> 1 then
    raise exception 'progress included a note moved outside the token deck: %', progress;
  end if;

  result := public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
    'external_id', 'lesson:long-payload', 'version', 1, 'type', 'note',
    'fields', jsonb_build_object('title', repeat('T', 1000), 'body', repeat('B', 25000)),
    'tags', (select jsonb_agg(repeat('t', 100)) from generate_series(1, 50)),
    'source', repeat('s', 8192), 'content_hash', repeat('9', 64)
  )));
  if not exists (
    select 1 from public.notes n
    where n.id = (result->0->>'note_id')::uuid
      and length(n.fields->>'title') = 1000
      and length(n.fields->>'body') = 25000
      and cardinality(n.tags) = 50
      and length(n.source->>'source') = 8192
  ) then
    raise exception 'Hub sized fields, source, or tags were truncated or rejected';
  end if;

  delete from public.notes where id = qa_note_id and owner_id = first_user;
  begin
    perform public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
      'external_id', 'lesson:42', 'version', 3, 'type', 'qa',
      'fields', jsonb_build_object('question', 'Do not recreate', 'answer', 'Keep deleted'),
      'tags', jsonb_build_array('javascript'), 'source', 'lesson-42.md', 'content_hash', repeat('8', 64)
    )));
    raise exception 'expected deleted integration note to remain tombstoned' using errcode = 'P0001';
  exception when serialization_failure then
    null;
  end;
  if not exists (
    select 1 from private.learning_hub_notes m
    where m.owner_id = first_user and m.deck_id = first_deck
      and m.external_id = 'lesson:42' and m.note_id is null
  ) then
    raise exception 'deleting an imported note removed its tombstone mapping';
  end if;
  if exists (select 1 from public.notes n where n.source->>'external_id' = 'lesson:42') then
    raise exception 'sync recreated a note after a local deletion';
  end if;

  if not public.learning_hub_revoke_token(token_id) then raise exception 'owner could not revoke their token'; end if;
  begin
    perform public.learning_hub_status(token_text, 100, 0);
    raise exception 'expected revoked token to fail status lookup' using errcode = 'P0001';
  exception when invalid_authorization_specification then
    null;
  end;
  begin
    perform public.learning_hub_sync(token_text, jsonb_build_array(jsonb_build_object(
      'external_id', 'lesson:42', 'version', 3, 'type', 'qa',
      'fields', jsonb_build_object('question', 'Q', 'answer', 'A'),
      'tags', jsonb_build_array(), 'source', 'lesson-42.md', 'content_hash', repeat('8', 64)
    )));
    raise exception 'expected revoked token to fail sync' using errcode = 'P0001';
  exception when invalid_authorization_specification then
    null;
  end;
end;
$$;
rollback;
