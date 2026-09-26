-- Current, distinct learners; demo accounts and deleted copies do not count.
-- Keep reads cheap: update the aggregate in the same transaction as membership.
lock table public.user_books in share row exclusive mode;

create or replace function private.refresh_book_learner_count(p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Compatible with FK key-share locks. A separate statement after this lock
  -- reads the latest committed memberships when simultaneous joins serialize.
  perform 1 from public.books where id = p_book_id for no key update;
  update public.books b set learner_count = (
    select count(distinct ub.owner_id)::integer
    from public.user_books ub
    join auth.users u on u.id = ub.owner_id
    join public.decks d on d.id = ub.deck_id
      and d.owner_id = ub.owner_id and d.source_book_id = ub.book_id
    where ub.book_id = p_book_id
      and lower(coalesce(u.email, '')) <> 'demo@huaji.local'
  ) where b.id = p_book_id;
end;
$$;
revoke all on function private.refresh_book_learner_count(uuid) from public, anon, authenticated;

create or replace function private.on_book_membership_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_book uuid;
  next_book uuid;
  changed_book uuid;
begin
  if tg_op <> 'INSERT' then previous_book := old.book_id; end if;
  if tg_op <> 'DELETE' then next_book := new.book_id; end if;
  for changed_book in
    select distinct id from unnest(array[previous_book, next_book]) as ids(id)
    where id is not null order by id
  loop
    perform private.refresh_book_learner_count(changed_book);
  end loop;
  return null;
end;
$$;
revoke all on function private.on_book_membership_changed() from public, anon, authenticated;
drop trigger if exists update_book_learner_count on public.user_books;
create trigger update_book_learner_count
  after insert or update or delete on public.user_books
  for each row execute function private.on_book_membership_changed();

create or replace function private.on_learner_email_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare changed_book uuid;
begin
  if (lower(coalesce(old.email, '')) = 'demo@huaji.local') is distinct from
     (lower(coalesce(new.email, '')) = 'demo@huaji.local') then
    for changed_book in select book_id from public.user_books where owner_id = new.id order by book_id loop
      perform private.refresh_book_learner_count(changed_book);
    end loop;
  end if;
  return null;
end;
$$;
revoke all on function private.on_learner_email_changed() from public, anon, authenticated;
drop trigger if exists update_learner_counts_on_email on auth.users;
create trigger update_learner_counts_on_email after update of email on auth.users
  for each row execute function private.on_learner_email_changed();

create or replace function private.on_joined_deck_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare changed_book uuid;
begin
  for changed_book in select book_id from public.user_books where deck_id = new.id order by book_id loop
    perform private.refresh_book_learner_count(changed_book);
  end loop;
  return null;
end;
$$;
revoke all on function private.on_joined_deck_changed() from public, anon, authenticated;
drop trigger if exists update_learner_counts_on_deck on public.decks;
create trigger update_learner_counts_on_deck after update of owner_id, source_book_id on public.decks
  for each row execute function private.on_joined_deck_changed();

-- Clear historical seed numbers, including books with no real learners.
update public.books b set learner_count = (
  select count(distinct ub.owner_id)::integer
  from public.user_books ub
  join auth.users u on u.id = ub.owner_id
  join public.decks d on d.id = ub.deck_id
    and d.owner_id = ub.owner_id and d.source_book_id = ub.book_id
  where ub.book_id = b.id and lower(coalesce(u.email, '')) <> 'demo@huaji.local'
);
comment on column public.books.learner_count is
  'Distinct current owners of joined copies, excluding demo@huaji.local; maintained by membership triggers.';

create or replace function private.join_book(p_book_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  new_deck_id uuid;
  existing_deck uuid;
  b public.books%rowtype;
  bn public.book_notes%rowtype;
  new_note_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  -- A double-click or a second tab must not create a second copy of the book.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_book_id::text, 0));
  select deck_id into existing_deck from public.user_books
  where owner_id = uid and book_id = p_book_id;
  if existing_deck is not null then return existing_deck; end if;

  select * into b from public.books where id = p_book_id;
  if not found then raise exception 'book not found'; end if;

  insert into public.decks (owner_id, name, icon, description, source_book_id)
  values (uid, b.title, 'book', b.description, b.id)
  returning id into new_deck_id;

  for bn in
    select * from public.book_notes where book_id = p_book_id order by sort_order, id
  loop
    insert into public.notes (deck_id, owner_id, type, fields, tags, layout, source)
    values (
      new_deck_id, uid, bn.type, bn.fields,
      array(select distinct tag from unnest(bn.tags || array[bn.chapter]) as t(tag)
            where tag is not null and tag <> '' order by tag),
      bn.layout, bn.source
    ) returning id into new_note_id;
    perform private.sync_note_cards(new_note_id, new_deck_id, uid, bn.type, bn.fields);
  end loop;

  insert into public.user_books (owner_id, book_id, deck_id)
  values (uid, p_book_id, new_deck_id)
  on conflict (owner_id, book_id) do update set deck_id = excluded.deck_id;

  -- The membership trigger maintains the exact current learner count.
  return new_deck_id;
end;
$$;
