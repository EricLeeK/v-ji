const AUTO_TONES = ["sky", "apricot", "lilac", "mint"] as const;

export const DECK_COLORS = [...AUTO_TONES, "rose", "lemon", "sea", "iris"] as const;

export type DeckColor = (typeof DECK_COLORS)[number];

export const DECK_COLOR_LABELS: Record<DeckColor, string> = {
  sky: "天蓝",
  apricot: "杏黄",
  lilac: "藤紫",
  mint: "薄荷",
  rose: "玫红",
  lemon: "柠檬黄",
  sea: "海青",
  iris: "鸢尾",
};

const COLOR_SET = new Set<string>(DECK_COLORS);

export function isDeckColor(value: string): value is DeckColor {
  return COLOR_SET.has(value);
}

/** Keep an unset deck's color stable when searching, sorting or opening another page. */
export function deckTone(id: string): DeckColor {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return AUTO_TONES[hash % AUTO_TONES.length];
}

export function resolveDeckColor(color: string | null | undefined, id: string): DeckColor {
  if (color && isDeckColor(color)) return color;
  return deckTone(id);
}
