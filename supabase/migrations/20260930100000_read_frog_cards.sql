alter type public.note_type add value if not exists 'dict' before 'note';
alter type public.note_type add value if not exists 'sentence' before 'note';
alter type public.note_type add value if not exists 'writing' before 'note';
