const DECK_TONES = ["sky", "apricot", "lilac", "mint"] as const;

/** Keep a deck's color stable when searching, sorting or opening another page. */
export function deckTone(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return DECK_TONES[hash % DECK_TONES.length];
}
