import { Mark, mergeAttributes } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { clozeIds, nextClozeIndex } from "@/lib/cloze";

export const ClozeMark = Mark.create({
  name: "cloze",
  excludes: "",
  spanning: false,
  addAttributes() {
    return {
      id: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute("data-cloze") ?? "1"),
        renderHTML: (attributes) => ({ "data-cloze": attributes.id }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-cloze]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "cloze-mark" }), 0];
  },
});

const TOKEN_RE = /\{\{c(\d+)::(.*?)(?:::(.*?))?}}/g;

export function clozeTextToDoc(text: string): JSONContent {
  const content: JSONContent[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(text))) {
    if (match.index > last) {
      content.push({ type: "text", text: text.slice(last, match.index) });
    }
    content.push({
      type: "text",
      text: match[2],
      marks: [{ type: "cloze", attrs: { id: Number(match[1]) } }],
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) content.push({ type: "text", text: text.slice(last) });
  return {
    type: "doc",
    content: [{ type: "paragraph", content: content.length ? content : [] }],
  };
}

function walkText(node: JSONContent | undefined): string {
  if (!node) return "";
  if (node.type === "text") {
    const cloze = node.marks?.find((mark) => mark.type === "cloze");
    if (cloze) {
      const id = Number(cloze.attrs?.id ?? 1);
      return `{{c${id}::${node.text ?? ""}}}`;
    }
    return node.text ?? "";
  }
  const children = (node.content ?? []).map(walkText).join("");
  if (node.type === "paragraph" || node.type === "hardBreak") return `${children}\n`;
  return children;
}

export function docToClozeText(doc: JSONContent): string {
  return walkText(doc).replace(/\n+$/, "");
}

export function nextClozeIdFromText(text: string) {
  return nextClozeIndex(text);
}

export function clozeCount(text: string) {
  return clozeIds(text).length;
}
