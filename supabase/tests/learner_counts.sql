-- Run as the database owner; all fixtures are rolled back, including auth users.
begin;
do $$
<<learner_counts>>
declare
  book_id uuid := gen_random_uuid();
  first_user uuid := gen_random_uuid();
  second_user uuid := gen_random_uuid();
  demo_user uuid;
  first_deck uuid;
  second_deck uuid;
  demo_deck uuid;
  actual integer;
begin
  select id into strict demo_user from auth.users where lower(email) = 'demo@huaji.local';
  insert into auth.users(id, email) values
    (first_user, first_user || '@learner-check.invalid'),
    (second_user, second_user || '@learner-check.invalid');
  insert into public.books(id, title) values(book_id, 'Transactional learner-count check');
  insert into public.book_notes(book_id, type, fields, chapter, layout, tags, source)
  values(book_id, 'qa', '{"question":"Question","answer":"Answer"}', 'Chapter', 'minimal', array['Tag'], '{"title":"Source"}');

  perform set_config('request.jwt.claim.sub', demo_user::text, true);
  demo_deck := private.join_book(book_id);
  select learner_count into actual from public.books where id = learner_counts.book_id;
  if actual <> 0 then raise exception 'Demo must not count: %', actual; end if;

  perform set_config('request.jwt.claim.sub', first_user::text, true);
  first_deck := private.join_book(book_id);
  if private.join_book(book_id) <> first_deck then raise exception 'Duplicate join created a copy'; end if;
  select learner_count into actual from public.books where id = learner_counts.book_id;
  if actual <> 1 then raise exception 'One real user / repeated join: %', actual; end if;
  if not exists(select 1 from public.notes where deck_id = first_deck and tags @> array['Tag','Chapter'] and source->>'title' = 'Source') then
    raise exception 'Join lost curriculum metadata';
  end if;

  perform set_config('request.jwt.claim.sub', second_user::text, true);
  second_deck := private.join_book(book_id);
  select learner_count into actual from public.books where id = learner_counts.book_id;
  if actual <> 2 then raise exception 'Two distinct real users: %', actual; end if;

  update auth.users set email = demo_user || '@learner-check.invalid' where id = demo_user;
  select learner_count into actual from public.books where id = learner_counts.book_id;
  if actual <> 3 then raise exception 'Email exclusion transition into real user: %', actual; end if;
  update auth.users set email = 'demo@huaji.local' where id = demo_user;
  select learner_count into actual from public.books where id = learner_counts.book_id;
  if actual <> 2 then raise exception 'Email transition back to demo: %', actual; end if;
  update public.decks set source_book_id = null where id = first_deck;
  select learner_count into actual from public.books where id = learner_counts.book_id;
  if actual <> 1 then raise exception 'Detached copy must not count: %', actual; end if;
  update public.decks set source_book_id = learner_counts.book_id where id = first_deck;
  select learner_count into actual from public.books where id = learner_counts.book_id;
  if actual <> 2 then raise exception 'Restored source count: %', actual; end if;

  delete from public.decks where id = first_deck;
  select learner_count into actual from public.books where id = learner_counts.book_id;
  if actual <> 1 then raise exception 'Deleted copy must stop counting: %', actual; end if;
  perform set_config('request.jwt.claim.sub', first_user::text, true);
  first_deck := private.join_book(book_id);
  select learner_count into actual from public.books where id = learner_counts.book_id;
  if actual <> 2 then raise exception 'Rejoin must count once: %', actual; end if;

  update public.profiles set nickname = 'A different demo nickname' where id = demo_user;
  select learner_count into actual from public.books where id = learner_counts.book_id;
  if actual <> 2 then raise exception 'Nickname must not change demo exclusion'; end if;
  delete from public.decks where id = demo_deck;
  select learner_count into actual from public.books where id = learner_counts.book_id;
  if actual <> 2 then raise exception 'Removing demo changed real count'; end if;

  delete from auth.users where id = first_user;
  select learner_count into actual from public.books where id = learner_counts.book_id;
  if actual <> 1 then raise exception 'Deleted account must stop counting: %', actual; end if;
  delete from public.user_books where owner_id = second_user and user_books.book_id = learner_counts.book_id;
  select learner_count into actual from public.books where id = learner_counts.book_id;
  if actual <> 0 then raise exception 'No remaining members must yield zero: %', actual; end if;
end;
$$;
rollback;
