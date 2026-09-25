-- Preserve curriculum structure and citations when a community book is joined.
alter table public.book_notes
  add column if not exists source jsonb,
  add column if not exists layout text not null default 'minimal',
  add column if not exists tags text[] not null default '{}';

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

  -- This is a cumulative join counter, including a join after deleting a copy.
  update public.books set learner_count = learner_count + 1 where id = p_book_id;
  return new_deck_id;
end;
$$;
