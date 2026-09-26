"use client";

import { cloneElement, isValidElement, useId, useState } from "react";
import { emptyFields, parseFields, sanitizeChoiceFields, TEMPLATES, validateNoteFields, type NoteFields } from "@/lib/templates";
import { useAction } from "@/lib/hooks/use-action";
import { saveNote } from "@/app/actions/notes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceEditor } from "@/components/cards/choice-editor";
import dynamic from "next/dynamic";
import { ImageUpload } from "@/components/cards/image-upload";
import type { Json, NoteType } from "@/types/database";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const loadClozeEditor = () => import("@/components/cards/cloze-editor");
const ClozeEditor = dynamic(() => loadClozeEditor().then((module) => module.ClozeEditor), {
  loading: () => <div role="status" className="flex min-h-40 items-center justify-center rounded-xl border border-input text-sm text-muted-foreground">正在加载挖空编辑器…</div>,
});

export function NoteEditor({
  deckId,
  noteId,
  initialType,
  initialFields,
}: {
  deckId: string;
  noteId?: string;
  initialType?: NoteType;
  initialFields?: Json;
}) {
  const router = useRouter();
  const [type, setType] = useState<NoteType>(initialType ?? "qa");
  const [fields, setFields] = useState<NoteFields>(
    initialFields ? parseFields(initialFields) : emptyFields(initialType ?? "qa"),
  );
  const { pending: saving, run } = useAction();

  function changeType(next: NoteType) {
    if (next === type) return;
    setType(next);
    setFields(emptyFields(next));
  }

  function patch(partial: NoteFields) {
    setFields((current) => ({ ...current, ...partial }));
  }

  async function onSave() {
    const invalid = validateNoteFields(type, fields);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    let fieldsToSave = fields;
    if (type === "choice") {
      const sanitized = sanitizeChoiceFields(fields);
      if (sanitized) fieldsToSave = { ...fields, ...sanitized };
    }
    await run(() => saveNote({ noteId, deckId, type, fields: fieldsToSave as Json }), () => {
      toast.success("卡片已保存");
      router.push(`/decks/${deckId}`);
      router.refresh();
    });
  }

  return (
    <fieldset disabled={saving} aria-busy={saving} className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        {TEMPLATES.map((item) => (
          <button
            key={item.type}
            type="button"
            onPointerEnter={() => { if (item.type === "cloze") void loadClozeEditor(); }}
            onFocus={() => { if (item.type === "cloze") void loadClozeEditor(); }}
            aria-pressed={type === item.type}
            onClick={() => changeType(item.type)}
            className={`rounded-2xl border px-3 py-2.5 text-left ${
              type === item.type ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            <div className="text-sm font-semibold">{item.label}</div>
            <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              {item.description}
            </div>
          </button>
        ))}
      </div>
      <ImageUpload value={fields.imageUrl} onChange={(imageUrl) => patch({ imageUrl })} />
      <TemplateFields type={type} fields={fields} onChange={patch} />
      <Button className="h-11 w-full rounded-full" onClick={onSave} disabled={saving}>
        {saving ? "保存中..." : "保存卡片"}
      </Button>
    </fieldset>
  );
}

export function TemplateFields({
  type,
  fields,
  onChange,
}: {
  type: NoteType;
  fields: NoteFields;
  onChange: (partial: NoteFields) => void;
}) {
  if (type === "qa") {
    return (
      <div className="space-y-3">
        <Field label="问题">
          <Textarea value={fields.question ?? ""} onChange={(e) => onChange({ question: e.target.value })} rows={3} />
        </Field>
        <Field label="答案">
          <Textarea value={fields.answer ?? ""} onChange={(e) => onChange({ answer: e.target.value })} rows={4} />
        </Field>
      </div>
    );
  }
  if (type === "note") {
    return (
      <div className="space-y-3">
        <Field label="标题">
          <Input value={fields.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
        </Field>
        <Field label="正文">
          <Textarea value={fields.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} rows={8} />
        </Field>
      </div>
    );
  }
  if (type === "vocab") {
    return (
      <div className="space-y-3">
        <Field label="单词">
          <Input value={fields.word ?? ""} onChange={(e) => onChange({ word: e.target.value })} />
        </Field>
        <Field label="音标">
          <Input value={fields.phonetic ?? ""} onChange={(e) => onChange({ phonetic: e.target.value })} />
        </Field>
        <Field label="释义">
          <Textarea value={fields.meaning ?? ""} onChange={(e) => onChange({ meaning: e.target.value })} rows={3} />
        </Field>
        <Field label="例句">
          <Textarea value={fields.example ?? ""} onChange={(e) => onChange({ example: e.target.value })} rows={3} />
        </Field>
      </div>
    );
  }
  if (type === "poem") {
    return (
      <div className="space-y-3">
        <Field label="标题">
          <Input value={fields.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
        </Field>
        <Field label="作者">
          <Input value={fields.author ?? ""} onChange={(e) => onChange({ author: e.target.value })} />
        </Field>
        <Field label="原文">
          <Textarea value={fields.original ?? ""} onChange={(e) => onChange({ original: e.target.value })} rows={4} />
        </Field>
        <Field label="译文">
          <Textarea value={fields.translation ?? ""} onChange={(e) => onChange({ translation: e.target.value })} rows={3} />
        </Field>
      </div>
    );
  }
  if (type === "choice") {
    return <ChoiceEditor fields={fields} onChange={onChange} />;
  }
  return <ClozeEditor value={fields.text ?? ""} onChange={(text) => onChange({ text })} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {isValidElement<{ id?: string; "aria-label"?: string }>(children) ? cloneElement(children, { id, "aria-label": label }) : children}
    </label>
  );
}
