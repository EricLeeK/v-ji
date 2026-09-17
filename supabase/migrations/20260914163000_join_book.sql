-- join_book RPC
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
  cloze_ord text;
  created_any boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select deck_id into existing_deck
  from public.user_books
  where owner_id = uid and book_id = p_book_id;

  if found then
    return existing_deck;
  end if;

  select * into b from public.books where id = p_book_id;
  if not found then
    raise exception 'book not found';
  end if;

  insert into public.decks (owner_id, name, icon, description, source_book_id)
  values (uid, b.title, '📗', b.description, b.id)
  returning id into new_deck_id;

  for bn in
    select * from public.book_notes where book_id = p_book_id order by sort_order, id
  loop
    insert into public.notes (deck_id, owner_id, type, fields)
    values (new_deck_id, uid, bn.type, bn.fields)
    returning id into new_note_id;

    created_any := false;
    if bn.type = 'cloze' then
      for cloze_ord in
        select distinct (regexp_matches(coalesce(bn.fields::text, ''), '\{\{c(\d+)::', 'g'))[1]
      loop
        insert into public.cards (note_id, deck_id, owner_id, ord)
        values (new_note_id, new_deck_id, uid, cloze_ord::int - 1);
        created_any := true;
      end loop;
    end if;

    if not created_any then
      insert into public.cards (note_id, deck_id, owner_id, ord)
      values (new_note_id, new_deck_id, uid, 0);
    end if;
  end loop;

  insert into public.user_books (owner_id, book_id, deck_id)
  values (uid, p_book_id, new_deck_id);

  update public.books set learner_count = learner_count + 1 where id = p_book_id;

  return new_deck_id;
end;
$$;

grant usage on schema private to authenticated;
grant execute on function private.join_book(uuid) to authenticated;

create or replace function public.join_book(p_book_id uuid)
returns uuid
language sql
security invoker
set search_path = public, private
as $$
  select private.join_book(p_book_id);
$$;

grant execute on function public.join_book(uuid) to authenticated;
revoke execute on function public.join_book(uuid) from anon, public;
