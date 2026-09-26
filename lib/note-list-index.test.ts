import { describe, expect, it } from 'vitest';
import { buildNoteIndex, filterNoteIndex } from './note-list-index';

const notes = [
  { id: 'a', type: 'qa' as const, fields: { question: 'Alpha 你好', answer: 'x' } },
  { id: 'b', type: 'qa' as const, fields: { question: 'Beta', answer: 'y' } },
];
const cards = [
  { note_id: 'a', state: 0, suspended: false, starred: false, due: '2026-01-01' },
  { note_id: 'a', state: 2, suspended: false, starred: true, due: '2026-01-01' },
  { note_id: 'b', state: 2, suspended: true, starred: false, due: '2026-01-01' },
];

describe('note search index', () => {
  it('keeps multi-card counts, review status and suspended semantics while searching', () => {
    const index = buildNoteIndex(notes, cards, Date.parse('2026-02-01'));
    expect(index[0]).toMatchObject({ cardCount: 2, starred: true, suspended: false, isNew: true, isReview: true });
    expect(index[1]).toMatchObject({ suspended: true, isReview: false });
    expect(filterNoteIndex(index, ' ALPHA ', 'all').map(x => x.note.id)).toEqual(['a']);
    expect(filterNoteIndex(index, '你好', 'review').map(x => x.note.id)).toEqual(['a']);
    expect(filterNoteIndex(index, '', 'suspended').map(x => x.note.id)).toEqual(['b']);
    expect(filterNoteIndex(index, 'missing', 'all')).toEqual([]);
  });

  it('indexes each card once instead of scanning all cards per note', () => {
    let reads = 0;
    const largeNotes = Array.from({ length: 2000 }, (_, i) => ({ ...notes[0], id: String(i) }));
    const largeCards = largeNotes.map(n => ({ ...cards[0], get note_id() { reads++; return n.id; } }));
    const index = buildNoteIndex(largeNotes, largeCards, Date.parse('2026-02-01'));
    expect(index).toHaveLength(2000);
    expect(reads).toBeLessThanOrEqual(4000);
    const beforeSearch = reads;
    filterNoteIndex(index, 'Alpha', 'new');
    expect(reads).toBe(beforeSearch);
  });
});
