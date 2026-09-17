create index if not exists cards_note_id_idx on public.cards (note_id);
create index if not exists decks_source_book_id_idx on public.decks (source_book_id);
create index if not exists feedback_owner_id_idx on public.feedback (owner_id);
create index if not exists review_logs_card_id_idx on public.review_logs (card_id);
create index if not exists user_books_book_id_idx on public.user_books (book_id);
create index if not exists user_books_deck_id_idx on public.user_books (deck_id);
