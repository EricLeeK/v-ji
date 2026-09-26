import { notePreview, parseFields } from '@/lib/templates';
import type { Json, NoteType } from '@/types/database';

export type NoteRow = { id: string; type: NoteType; fields: Json };
export type NoteCardRow = { note_id: string; state: number; suspended: boolean; starred: boolean; due: string };
export type NoteFilter = 'all' | 'new' | 'review' | 'starred' | 'suspended';
export type IndexedNote = {
  note: NoteRow;
  preview: string;
  searchText: string;
  cardCount: number;
  starred: boolean;
  suspended: boolean;
  isNew: boolean;
  isReview: boolean;
};

/** Build once per data update, not once per keystroke. O(notes + cards). */
export function buildNoteIndex(notes: NoteRow[], cards: NoteCardRow[], now: number): IndexedNote[] {
  const byNote = new Map<string, { cardCount: number; starred: boolean; suspended: boolean; isNew: boolean; isReview: boolean }>();
  for (const card of cards) {
    const row = byNote.get(card.note_id) ?? { cardCount: 0, starred: false, suspended: true, isNew: false, isReview: false };
    row.cardCount++;
    row.starred ||= card.starred;
    row.suspended &&= card.suspended;
    row.isNew ||= card.state === 0;
    row.isReview ||= card.state !== 0 && !card.suspended && Date.parse(card.due) <= now;
    byNote.set(card.note_id, row);
  }
  return notes.map(note => {
    const preview = notePreview(note.type, parseFields(note.fields));
    return {
      note, preview, searchText: preview.toLocaleLowerCase(),
      ...(byNote.get(note.id) ?? { cardCount: 0, starred: false, suspended: false, isNew: false, isReview: false }),
    };
  });
}

export function filterNoteIndex(index: IndexedNote[], query: string, filter: NoteFilter): IndexedNote[] {
  const normalized = query.trim().toLocaleLowerCase();
  return index.filter(item => {
    if (normalized && !item.searchText.includes(normalized)) return false;
    if (filter === 'new') return item.isNew;
    if (filter === 'review') return item.isReview;
    if (filter === 'starred') return item.starred;
    if (filter === 'suspended') return item.suspended;
    return true;
  });
}
