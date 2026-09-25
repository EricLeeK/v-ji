import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { clozeIds, clozeParts } from "./cloze";
import { validateNoteFields, type NoteFields } from "./templates";
import type { NoteType } from "@/types/database";

type Preset = {
  book: { id: string; title: string; toc: { title: string; count: number }[] };
  notes: { id: string; type: NoteType; fields: NoteFields; chapter: string; source: { file: string; page?: number; excerpt: string }; tags: string[] }[];
  editorial: { sourceFiles: string[] };
};

describe("community exam presets", () => {
  for (const [slug, sourceCount] of [["party-activist", 6], ["hubei-selected-graduates", 5]] as const) {
    it(`${slug} is a complete, traceable and studyable independent book`, () => {
      const path = resolve("content/presets", `${slug}.json`);
      expect(existsSync(path), "the requested preset must exist").toBe(true);
      const preset: Preset = JSON.parse(readFileSync(path, "utf8"));
      expect(preset.notes.length).toBeGreaterThan(600);
      expect(preset.editorial.sourceFiles).toHaveLength(sourceCount);
      expect(new Set(preset.notes.map((note) => note.id)).size).toBe(preset.notes.length);
      expect(new Set(preset.notes.map((note) => note.type))).toEqual(new Set(["qa", "cloze", "choice", "note"]));
      for (const note of preset.notes) {
        expect(validateNoteFields(note.type, note.fields), note.id).toBeNull();
        expect(note.source.file, note.id).toBeTruthy();
        expect(note.source.excerpt, note.id).toBeTruthy();
        expect(note.tags, note.id).toContain(note.chapter);
        const text = JSON.stringify(note.fields);
        expect(text, note.id).not.toMatch(/jdgk007|微信公众号|扫码|鄂编逢考必过|\uFFFD/);
        if (note.type === "choice") {
          const options = note.fields.options!;
          expect(new Set(options.map((option) => option.key)).size, note.id).toBe(options.length);
          expect(options.some((option) => option.key === note.fields.answer), note.id).toBe(true);
          expect(note.fields.stem, note.id).not.toMatch(/参考答案|[（(][A-F√×]+[)）]/);
        }
        if (note.type === "cloze") {
          const ids = clozeIds(note.fields.text!);
          expect(ids.length, note.id).toBeLessThanOrEqual(3);
          for (const id of ids) {
            const blanks = clozeParts(note.fields.text!, id - 1).filter((part) => part.type === "blank");
            expect(blanks.length, note.id).toBeGreaterThan(0);
            expect(blanks.every((part) => part.type === "blank" && part.answer.length <= 18), note.id).toBe(true);
          }
        }
      }
      for (const chapter of preset.book.toc) {
        const count = preset.notes.filter((note) => note.chapter === chapter.title).reduce((sum, note) => sum + (note.type === "cloze" ? clozeIds(note.fields.text!).length : 1), 0);
        expect(chapter.count, chapter.title).toBe(count);
      }
    });
  }
});
