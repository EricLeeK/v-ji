-- These three launch fixtures are samples, not complete textbooks or real publishers.
with samples(id, old_title, title, description) as (values
  ('11111111-1111-4111-8111-111111111111'::uuid, '考研英语核心词汇 5500', '考研英语词汇 · 示例', '用于体验词汇卡与间隔复习的示例内容，包含音标、释义与例句，并非完整考研词库。'),
  ('22222222-2222-4222-8222-222222222222'::uuid, '设计学概论考点精编', '设计学概论 · 示例', '用于体验问答卡的设计学示例内容，涵盖部分设计史与设计批评知识，并非完整复习教材。'),
  ('33333333-3333-4333-8333-333333333333'::uuid, '高考古诗文名句默写', '古诗文默写 · 示例', '用于体验古诗文与挖空练习的少量示例，并非完整高考背诵篇目。')
), renamed as (
  update public.books b set title=s.title, description=s.description, author='V 记 · 示例内容'
  from samples s where b.id=s.id returning b.id
)
-- Correct the unchanged sample titles in the demo account only.
update public.decks d set name=s.title
from samples s join renamed r on r.id=s.id
where d.source_book_id=s.id and d.name=s.old_title
  and d.owner_id in (select id from auth.users where lower(email)='demo@huaji.local');

-- Preserve chapter order/labels while deriving sizes from the cards actually created.
update public.books b set toc = (
  select jsonb_agg(jsonb_set(chapter.value, '{count}', to_jsonb((
    select coalesce(sum(cardinality(private.note_ords(n.type, n.fields))), 0)
    from public.book_notes n where n.book_id = b.id and n.chapter = chapter.value->>'title'
  ))) order by chapter.position)
  from jsonb_array_elements(b.toc) with ordinality as chapter(value, position)
)
where b.id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333');
