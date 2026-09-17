export const DECK_ICONS = ["book", "leaf", "bookmark", "archive", "notes", "pen", "flask", "atom", "scales", "landmark", "language", "characters", "target", "idea"] as const;
export type DeckIconName = (typeof DECK_ICONS)[number];
export const DECK_ICON_LABELS: Record<DeckIconName, string> = {
  book: "书本", leaf: "自然", bookmark: "书签", archive: "归档", notes: "笔记", pen: "写作", flask: "化学", atom: "科学", scales: "法律", landmark: "人文", language: "英语", characters: "中文", target: "目标", idea: "灵感",
};
// Resolve previously stored icon values without ever rendering them as text.
const legacyCodePoints = [0x1f4d8, 0x1f4d7, 0x1f4d5, 0x1f4d9, 0x1f4d2, 0x1f4dd, 0x1f9ea, 0x1f52c, 0x2696, 0x1f3db, 0x1f1ec, 0x1f1e8, 0x1f3af, 0x1f4a1];
export function resolveDeckIcon(value: string): DeckIconName {
  if (DECK_ICONS.includes(value as DeckIconName)) return value as DeckIconName;
  const index = legacyCodePoints.indexOf(value.codePointAt(0) ?? 0);
  return index < 0 ? "book" : DECK_ICONS[index];
}
