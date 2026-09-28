/** One shuffled deck session stays within the same card budget as a normal deck study batch. */
export const SHUFFLED_STUDY_LIMIT = 80;

export function shuffleItems<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const next = items.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = next[index];
    next[index] = next[swap];
    next[swap] = current;
  }
  return next;
}

export function pickShuffledIds(
  ids: readonly string[],
  limit = SHUFFLED_STUDY_LIMIT,
  random: () => number = Math.random,
) {
  return shuffleItems(ids, random).slice(0, Math.max(0, limit));
}

export function orderByIds<T extends { id: string }>(rows: readonly T[], ids: readonly string[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered: T[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row) ordered.push(row);
  }
  return ordered;
}
