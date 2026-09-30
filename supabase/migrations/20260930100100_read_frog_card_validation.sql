create or replace function private.validate_read_frog_annotations(p_value text, p_types text[], p_keys text[])
returns void
language plpgsql
stable
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_items jsonb;
  v_item jsonb;
  v_key text;
begin
  begin
    v_items := p_value::jsonb;
  exception when others then
    raise exception 'invalid annotation json' using errcode = '22023';
  end;
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'annotations must be an array' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(v_items) as items(value) loop
    if jsonb_typeof(v_item) <> 'object'
       or not private.learning_hub_only_keys(v_item, p_keys)
       or jsonb_typeof(v_item->'text') is distinct from 'string'
       or length(btrim(coalesce(v_item->>'text', ''))) = 0
       or jsonb_typeof(v_item->'type') is distinct from 'string'
       or (v_item->>'type') != all(p_types) then
      raise exception 'invalid annotation item' using errcode = '22023';
    end if;
    for v_key in select jsonb_object_keys(v_item) loop
      if v_key = 'occurrence' then
        if jsonb_typeof(v_item->v_key) <> 'number'
           or trunc((v_item->>v_key)::numeric) <> (v_item->>v_key)::numeric
           or (v_item->>v_key)::numeric < 1 then
          raise exception 'invalid annotation occurrence' using errcode = '22023';
        end if;
      elsif jsonb_typeof(v_item->v_key) is distinct from 'string' then
        raise exception 'invalid annotation text' using errcode = '22023';
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function private.learning_hub_validate_fields(p_type text, p_fields jsonb)
returns integer[]
language plpgsql
stable
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_start_count integer;
  v_valid_count integer;
  v_pair record;
  v_text text;
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
       or jsonb_typeof(p_fields->'question') is distinct from 'string'
       or jsonb_typeof(p_fields->'answer') is distinct from 'string'
       or length(btrim(coalesce(p_fields->>'question', ''))) = 0
       or length(btrim(coalesce(p_fields->>'answer', ''))) = 0
       or length(p_fields->>'question') > 500000
       or length(p_fields->>'answer') > 500000 then
      raise exception 'invalid qa fields' using errcode = '22023';
    end if;
    return array[0];
  elsif p_type = 'dict' then
    if not private.learning_hub_only_keys(p_fields, array['term', 'phonetic', 'partOfSpeech', 'definition', 'context', 'contextTerm', 'contextTranslation', 'difficulty'])
       or jsonb_typeof(p_fields->'term') is distinct from 'string'
       or jsonb_typeof(p_fields->'definition') is distinct from 'string'
       or length(btrim(coalesce(p_fields->>'term', ''))) = 0
       or length(btrim(coalesce(p_fields->>'definition', ''))) = 0 then
      raise exception 'invalid dict fields' using errcode = '22023';
    end if;
    for v_pair in select key_name, value from jsonb_each(p_fields) as f(key_name, value) loop
      if jsonb_typeof(v_pair.value) <> 'string' or length(v_pair.value #>> '{}') > 500000 then
        raise exception 'invalid dict text' using errcode = '22023';
      end if;
    end loop;
    return array[0];
  elsif p_type = 'sentence' then
    if not private.learning_hub_only_keys(p_fields, array['sentence', 'annotations', 'translation'])
       or jsonb_typeof(p_fields->'sentence') is distinct from 'string'
       or jsonb_typeof(p_fields->'annotations') is distinct from 'string'
       or length(btrim(coalesce(p_fields->>'sentence', ''))) = 0
       or length(btrim(coalesce(p_fields->>'annotations', ''))) = 0 then
      raise exception 'invalid sentence fields' using errcode = '22023';
    end if;
    perform private.validate_read_frog_annotations(p_fields->>'annotations', array['subject','predicate','object','complement','attributive','adverbial','appositive','connector'], array['text','type','form','sense','head','obstacle','restore','note','occurrence']);
    return array[0];
  elsif p_type = 'writing' then
    if not private.learning_hub_only_keys(p_fields, array['original', 'annotations', 'improved', 'summary', 'setting'])
       or jsonb_typeof(p_fields->'original') is distinct from 'string'
       or jsonb_typeof(p_fields->'annotations') is distinct from 'string'
       or length(btrim(coalesce(p_fields->>'original', ''))) = 0
       or length(btrim(coalesce(p_fields->>'annotations', ''))) = 0 then
      raise exception 'invalid writing fields' using errcode = '22023';
    end if;
    perform private.validate_read_frog_annotations(p_fields->>'annotations', array['spelling','grammar','punctuation','word-choice','logic','unnatural','register','clarity','good'], array['text','fix','type','tag','note','occurrence']);
    return array[0];
  elsif p_type = 'choice' then
    if not private.learning_hub_only_keys(p_fields, array['stem', 'options', 'answer', 'explain'])
       or jsonb_typeof(p_fields->'stem') is distinct from 'string'
       or length(btrim(coalesce(p_fields->>'stem', ''))) = 0
       or jsonb_typeof(p_fields->'options') is distinct from 'array'
       or jsonb_array_length(p_fields->'options') not between 2 and 6
       or jsonb_typeof(p_fields->'answer') is distinct from 'string'
       or not exists (
         select 1 from jsonb_array_elements(p_fields->'options') option(item)
         where jsonb_typeof(option.item) = 'object'
           and option.item->>'key' = p_fields->>'answer'
       ) then
      raise exception 'invalid choice fields' using errcode = '22023';
    end if;
    for v_pair in select key_name, value from jsonb_each(p_fields) as f(key_name, value) loop
      if v_pair.key_name <> 'options' and jsonb_typeof(v_pair.value) <> 'string' then
        raise exception 'invalid choice text' using errcode = '22023';
      end if;
    end loop;
    if exists (
      select 1 from jsonb_array_elements(p_fields->'options') option(item)
      where jsonb_typeof(option.item) <> 'object'
         or not private.learning_hub_only_keys(option.item, array['key', 'text'])
         or jsonb_typeof(option.item->'key') is distinct from 'string'
         or jsonb_typeof(option.item->'text') is distinct from 'string'
         or length(btrim(coalesce(option.item->>'key', ''))) = 0
         or length(btrim(coalesce(option.item->>'text', ''))) = 0
         or option.item->>'key' !~ '^[A-F]$'
    ) then
      raise exception 'invalid choice option' using errcode = '22023';
    end if;
    if (select count(distinct item->>'key') from jsonb_array_elements(p_fields->'options') option(item)) <> jsonb_array_length(p_fields->'options') then
      raise exception 'choice option keys must be unique' using errcode = '22023';
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
    select count(*) into v_start_count from regexp_matches(v_text, '\{\{c[0-9]+::', 'g');
    select count(*) into v_valid_count from regexp_matches(v_text, '\{\{c([1-9][0-9]*)::[^{}]+(?:::[^{}]*)?\}\}', 'g');
    if v_start_count = 0 or v_start_count <> v_valid_count then
      raise exception 'invalid cloze markup' using errcode = '22023';
    end if;
    for v_pair in
      select (match)[1] as id_text
      from regexp_matches(v_text, '\{\{c([1-9][0-9]*)::[^{}]+(?:::[^{}]*)?\}\}', 'g') as matches(match)
    loop
      if v_pair.id_text::integer > 100 then
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

revoke all on function private.validate_read_frog_annotations(text, text[], text[]) from public, anon, authenticated;
revoke all on function private.learning_hub_validate_fields(text, jsonb) from public, anon, authenticated;
