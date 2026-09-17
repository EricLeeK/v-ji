"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import { ClozeMark, clozeTextToDoc, docToClozeText, nextClozeIdFromText } from "@/lib/cloze-doc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ClozeEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder: "输入一段文字，选中关键词后点挖空" }),
      ClozeMark,
    ],
    content: clozeTextToDoc(value),
    editorProps: {
      attributes: {
        class:
          "min-h-40 rounded-xl border border-input bg-transparent px-3 py-2 text-sm leading-7 outline-none",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(docToClozeText(instance.getJSON()));
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = docToClozeText(editor.getJSON());
    if (current !== value) {
      editor.commands.setContent(clozeTextToDoc(value), { emitUpdate: false });
    }
  }, [editor, value]);

  function applyCloze() {
    if (!editor) return;
    const { empty } = editor.state.selection;
    if (empty) return;
    const id = nextClozeIdFromText(docToClozeText(editor.getJSON()));
    editor.chain().focus().setMark("cloze", { id }).run();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>正文（选中文字后点挖空）</Label>
        <Button type="button" size="sm" variant="outline" onClick={applyCloze}>
          挖空
        </Button>
      </div>
      <EditorContent editor={editor} />
      <p className="text-xs text-muted-foreground">挖空会保存为 Anki 兼容的 {"{{c1::关键词}}"} 格式。</p>
    </div>
  );
}
