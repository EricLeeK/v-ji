import { localDateKey } from "@/lib/dates";

export type HeatDay = { date: string; count: number };

export function buildHeatmap(
  rows: Array<{ date: string; reviews: number }>,
  today = localDateKey(),
  weeks = 16,
): HeatDay[] {
  const map = new Map(rows.map((row) => [row.date, row.reviews]));
  const end = new Date(`${today}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - start.getDay() - (weeks - 1) * 7);
  const days: HeatDay[] = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const cursor = new Date(start);
    cursor.setDate(start.getDate() + i);
    const date = localDateKey(cursor);
    days.push({ date, count: map.get(date) ?? 0 });
  }
  return days;
}

export function heatLevel(count: number) {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 6) return 2;
  return 3;
}

export function sumSince(
  rows: Array<{ date: string; reviews: number; study_seconds: number }>,
  fromDate: string,
) {
  return rows
    .filter((row) => row.date >= fromDate)
    .reduce(
      (acc, row) => ({
        reviews: acc.reviews + row.reviews,
        seconds: acc.seconds + row.study_seconds,
      }),
      { reviews: 0, seconds: 0 },
    );
}
