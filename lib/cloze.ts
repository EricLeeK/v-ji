const CLOZE_RE = /\{\{c(\d+)::(.*?)(?:::(.*?))?}}/g;

export type ClozePart = { type: "text"; value: string } | { type: "blank"; answer: string };

export function nextClozeIndex(text: string) {
  const ids = [...text.matchAll(/\{\{c(\d+)::/g)].map((match) => Number(match[1]));
  return (ids.length ? Math.max(...ids) : 0) + 1;
}

export function wrapCloze(text: string, start: number, end: number) {
  if (start === end) return text;
  const selected = text.slice(start, end);
  const id = nextClozeIndex(text);
  return `${text.slice(0, start)}{{c${id}::${selected}}}${text.slice(end)}`;
}

export function clozeIds(text: string) {
  return [...new Set([...text.matchAll(/\{\{c(\d+)::/g)].map((m) => Number(m[1])))].sort(
    (a, b) => a - b,
  );
}

export function renderCloze(text: string, ord: number, revealed: boolean) {
  const target = ord + 1;
  return text.replace(CLOZE_RE, (_full, id: string, answer: string) => {
    if (Number(id) !== target) return answer;
    return revealed ? answer : "______";
  });
}

/** Split cloze markup so the study face can size a blank to the hidden answer. */
export function clozeParts(text: string, ord: number): ClozePart[] {
  const target = ord + 1;
  const parts: ClozePart[] = [];
  let last = 0;
  const re = new RegExp(CLOZE_RE.source, "g");
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > last) {
      pushText(parts, text.slice(last, index));
    }
    const answer = match[2] ?? "";
    if (Number(match[1]) === target) {
      parts.push({ type: "blank", answer });
    } else {
      pushText(parts, answer);
    }
    last = index + match[0].length;
  }
  if (last < text.length) pushText(parts, text.slice(last));
  return parts;
}

function pushText(parts: ClozePart[], value: string) {
  if (!value) return;
  const prev = parts[parts.length - 1];
  if (prev?.type === "text") {
    prev.value += value;
    return;
  }
  parts.push({ type: "text", value });
}

export function stripCloze(text: string) {
  return text.replace(CLOZE_RE, (_full, _id, answer: string) => answer);
}
