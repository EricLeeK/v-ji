import type { SVGProps } from "react";
import { resolveDeckIcon } from "@/lib/deck-icons";

// A shared 24-unit grid, soft corners and restrained inset fills for V-记.
const paths: Record<string, string> = {
  book: "M5 4h13a1 1 0 0 1 1 1v15H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2ZM7 4v12m-4 1a2 2 0 0 1 2-2h14M10 8h5m-5 3h3",
  leaf: "M19 4C8 3 3 8 5 14s14 6 14-10ZM5 20 15 9m-6 7v-5m0 5h5",
  bookmark: "M6 4h12v17l-6-4-6 4V4Zm4 4h4",
  archive: "M4 8h16v12H4V8Zm-1-4h18v4H3V4Zm6 8h6",
  notes: "M6 4h13v17H6V4ZM3 8h5m-5 5h5m-5 5h5m3-10h5m-5 4h5m-5 4h3",
  pen: "m5 15-1 5 5-1L20 8l-4-4L5 15Zm8-8 4 4M5 15l4 4m4 1h7",
  flask: "M9 3h6m-5 0v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10m-6 3h2",
  atom: "M12 11v2m-9-1c0-5 18-5 18 0s-18 5-18 0Zm4-8c4-2 13 14 9 16S3 5 7 4Zm10 0C13 2 4 18 8 20S21 6 17 4Z",
  scales: "M12 3v17m-5 1h10M4 7h16M6 7l-3 7h6L6 7Zm12 0-3 7h6l-3-7Z",
  landmark: "m3 8 9-5 9 5H3Zm2 3v7m5-7v7m4-7v7m5-7v7M3 21h18",
  language: "m3 19 5-14 5 14M5 14h6m3-9h6m-3-2v2m-3 3c0 5 3 8 7 9m-1-9c0 5-2 8-6 10",
  characters: "M5 6h14v10H5V6Zm7-3v18M3 20h4m10 0h4",
  target: "M20 12a8 8 0 1 1-8-8m4 8a4 4 0 1 1-4-4m0 4 9-9m-5 0h5v5",
  idea: "M8 15a6 6 0 1 1 8 0l-1 2H9l-1-2Zm1 5h6m-5 2h4m-2-5v-6m-2 0 2 2 2-2",
  memory: "M5 8a8 8 0 1 1-1 7M3 4v5h5m1 2h6v6H9v-6Z",
  swipe: "M8 5h8v14H8V5ZM2 12h4m-2-2-2 2 2 2m14-2h4m-2-2 2 2-2 2",
  library: "M3 5h4v15H3V5Zm7-2h4v17h-4V3Zm6 3 3-1 3 14-3 1-3-14Z",
  chart: "M4 3v17h17M8 16v-5m5 5V7m5 9V4",
  cards: "m4 8-2 1 3 12 11-3M7 3h13v15H7V3Zm4 5h5m-5 4h3",
  complete: "M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Zm-4 9 3 3 5-6",
  offline: "M8 17H6a4 4 0 0 1-1-8 7 7 0 0 1 13-1 5 5 0 0 1 1 9h-3M9 14l6 6m0-6-6 6",
  star: "m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1 3-6Z",
  diamond: "m12 3 8 9-8 9-8-9 8-9Z",
  dot: "M11 12h2",
};
export function AppIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}><path d={paths[name] ?? paths.book} /></svg>;
}
export function DeckIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  return <AppIcon name={resolveDeckIcon(name)} {...props} />;
}
