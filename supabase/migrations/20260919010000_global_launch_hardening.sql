-- Global launch hardening: close direct privileged-function access and make
-- review/move writes atomic under a row lock.

revoke execute on function private.sync_note_cards(uuid, uuid, uuid, public.note_type, jsonb)
  from public, anon, authenticated;
drop policy if exists ai_usage_insert_own on public.ai_usage;
revoke insert on public.ai_usage from public, anon, authenticated;
drop policy if exists review_logs_all_own on public.review_logs;
create policy review_logs_select_own on public.review_logs
  for select to authenticated
  using (owner_id = (select auth.uid()));
revoke insert, update, delete on public.review_logs from public, anon, authenticated;
drop policy if exists daily_stats_all_own on public.daily_stats;
create policy daily_stats_select_own on public.daily_stats
  for select to authenticated
  using (owner_id = (select auth.uid()));
revoke insert, update, delete on public.daily_stats from public, anon, authenticated;

create or replace function private.submit_review(
  p_card_id uuid,
  p_rating integer,
  p_next jsonb,
  p_duration_ms integer,
  p_date date,
  p_expected_due timestamptz,
  p_expected_state integer,
  p_expected_reps integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  current_card public.cards%rowtype;
  next_due timestamptz;
  next_last_review timestamptz;
  next_stability double precision;
  next_difficulty double precision;
  next_elapsed_days integer;
  next_scheduled_days integer;
  next_learning_steps integer;
  next_reps integer;
  next_lapses integer;
  next_state integer;
  safe_duration integer := greatest(0, least(coalesce(p_duration_ms, 0), 86400000));
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_rating not between 1 and 4 then raise exception 'invalid rating'; end if;
  if p_next is null or jsonb_typeof(p_next) <> 'object' then raise exception 'invalid review payload'; end if;

  select * into current_card
  from public.cards
  where id = p_card_id and owner_id = uid
  for update;
  if not found then raise exception 'card not found'; end if;

  if current_card.due is distinct from p_expected_due
     or current_card.state <> p_expected_state
     or current_card.reps <> p_expected_reps then
    raise exception 'review conflict: card was changed in another session';
  end if;

  next_due := (p_next->>'due')::timestamptz;
  next_last_review := case when nullif(p_next->>'last_review', '') is null then null else (p_next->>'last_review')::timestamptz end;
  next_stability := (p_next->>'stability')::double precision;
  next_difficulty := (p_next->>'difficulty')::double precision;
  next_elapsed_days := (p_next->>'elapsed_days')::integer;
  next_scheduled_days := (p_next->>'scheduled_days')::integer;
  next_learning_steps := (p_next->>'learning_steps')::integer;
  next_reps := (p_next->>'reps')::integer;
  next_lapses := (p_next->>'lapses')::integer;
  next_state := (p_next->>'state')::integer;

  update public.cards
  set due = next_due,
      stability = next_stability,
      difficulty = next_difficulty,
      elapsed_days = next_elapsed_days,
      scheduled_days = next_scheduled_days,
      learning_steps = next_learning_steps,
      reps = next_reps,
      lapses = next_lapses,
      state = next_state,
      last_review = next_last_review
  where id = p_card_id and owner_id = uid;

  insert into public.review_logs (
    card_id, owner_id, rating, state, due, stability, difficulty,
    elapsed_days, scheduled_days, duration_ms
  ) values (
    p_card_id, uid, p_rating, next_state, next_due, next_stability,
    next_difficulty, next_elapsed_days, next_scheduled_days, safe_duration
  );

  insert into public.daily_stats (owner_id, date, reviews, new_cards, study_seconds)
  values (uid, p_date, 1, case when current_card.state = 0 then 1 else 0 end, safe_duration / 1000)
  on conflict (owner_id, date) do update set
    reviews = public.daily_stats.reviews + 1,
    new_cards = public.daily_stats.new_cards + excluded.new_cards,
    study_seconds = public.daily_stats.study_seconds + excluded.study_seconds;
end;
$$;

create or replace function public.submit_review(
  p_card_id uuid,
  p_rating integer,
  p_next jsonb,
  p_duration_ms integer,
  p_date date,
  p_expected_due timestamptz,
  p_expected_state integer,
  p_expected_reps integer
)
returns void
language sql
security definer
set search_path = public, private
as $$
  select private.submit_review(
    p_card_id, p_rating, p_next, p_duration_ms, p_date,
    p_expected_due, p_expected_state, p_expected_reps
  );
$$;
grant execute on function public.submit_review(uuid, integer, jsonb, integer, date, timestamptz, integer, integer)
  to authenticated;
revoke execute on function public.submit_review(uuid, integer, jsonb, integer, date, timestamptz, integer, integer)
  from public, anon;
revoke execute on function private.submit_review(uuid, integer, jsonb, integer, date, timestamptz, integer, integer)
  from public, anon, authenticated;

create or replace function private.move_note(p_note_id uuid, p_from_deck_id uuid, p_to_deck_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_from_deck_id = p_to_deck_id then return; end if;
  if not exists (select 1 from public.decks where id = p_from_deck_id and owner_id = uid) then
    raise exception 'source deck not found';
  end if;
  if not exists (select 1 from public.decks where id = p_to_deck_id and owner_id = uid) then
    raise exception 'target deck not found';
  end if;
  if not exists (
    select 1 from public.notes
    where id = p_note_id and owner_id = uid and deck_id = p_from_deck_id
  ) then
    raise exception 'note not found';
  end if;

  update public.notes set deck_id = p_to_deck_id
  where id = p_note_id and owner_id = uid and deck_id = p_from_deck_id;
  update public.cards set deck_id = p_to_deck_id
  where note_id = p_note_id and owner_id = uid and deck_id = p_from_deck_id;
end;
$$;

create or replace function public.move_note(p_note_id uuid, p_from_deck_id uuid, p_to_deck_id uuid)
returns void
language sql
security definer
set search_path = public, private
as $$ select private.move_note(p_note_id, p_from_deck_id, p_to_deck_id); $$;
grant execute on function public.move_note(uuid, uuid, uuid) to authenticated;
revoke execute on function public.move_note(uuid, uuid, uuid) from public, anon;
revoke execute on function private.move_note(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function private.enforce_note_card_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.decks where id = new.deck_id and owner_id = new.owner_id) then
    raise exception 'deck owner mismatch';
  end if;
  if tg_table_name = 'cards' and not exists (
    select 1 from public.notes
    where id = new.note_id and owner_id = new.owner_id and deck_id = new.deck_id
  ) then
    raise exception 'note deck mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_notes_owner_deck on public.notes;
create trigger enforce_notes_owner_deck
  before insert or update of deck_id, owner_id on public.notes
  for each row execute function private.enforce_note_card_ownership();
drop trigger if exists enforce_cards_owner_deck on public.cards;
create trigger enforce_cards_owner_deck
  before insert or update of deck_id, owner_id, note_id on public.cards
  for each row execute function private.enforce_note_card_ownership();

create or replace function private.enforce_ai_source_job_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare job_owner uuid;
begin
  select owner_id into job_owner from public.ai_jobs where id = new.job_id;
  if job_owner is null or new.owner_id <> job_owner then raise exception 'AI source owner mismatch'; end if;
  if new.storage_path is not null and split_part(new.storage_path, '/', 1) <> new.owner_id::text then
    raise exception 'AI source storage owner mismatch';
  end if;
  if new.kind = 'text' and new.storage_path is not null then
    raise exception 'text source cannot have a storage path';
  end if;
  if new.kind <> 'text' and new.storage_path is null then
    raise exception 'file source is missing a storage path';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_ai_source_owner on public.ai_sources;
create trigger enforce_ai_source_owner
  before insert or update of job_id, owner_id on public.ai_sources
  for each row execute function private.enforce_ai_source_job_owner();

create or replace function private.enforce_ai_job_deck_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deck_id is not null and not exists (
    select 1 from public.decks where id = new.deck_id and owner_id = new.owner_id
  ) then
    raise exception 'AI job deck owner mismatch';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_ai_job_deck on public.ai_jobs;
create trigger enforce_ai_job_deck
  before insert or update of deck_id, owner_id on public.ai_jobs
  for each row execute function private.enforce_ai_job_deck_owner();

create or replace function private.enforce_ai_card_job_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare job_owner uuid;
begin
  select owner_id into job_owner from public.ai_jobs where id = new.job_id;
  if job_owner is null or new.owner_id <> job_owner then raise exception 'AI card owner mismatch'; end if;
  return new;
end;
$$;
drop trigger if exists enforce_ai_card_owner on public.ai_cards;
create trigger enforce_ai_card_owner
  before insert or update of job_id, owner_id on public.ai_cards
  for each row execute function private.enforce_ai_card_job_owner();

create or replace function private.enforce_ai_chunk_source_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.ai_sources where id = new.source_id and job_id = new.job_id) then
    raise exception 'AI chunk source mismatch';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_ai_chunk_source on public.ai_chunks;
create trigger enforce_ai_chunk_source
  before insert or update of job_id, source_id on public.ai_chunks
  for each row execute function private.enforce_ai_chunk_source_job();
