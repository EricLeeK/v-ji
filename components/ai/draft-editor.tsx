"use client";

import { useState } from "react";
import { TemplateFields } from "@/components/cards/note-editor";
import { emptyFields, parseFields, sanitizeChoiceFields, type NoteFields } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import type { Json, NoteType } from "@/types/database";

export function DraftEditor({
  type,
  fields,
  layout,
  onCancel,
  onSave,
}: {
  type: NoteType;
  fields: Json;
  layout: string;
  onCancel: () => void;
  onSave: (patch: { type: NoteType; fields: Json; layout: string }) => Promise<void>;
}) {
  const [nextType] = useState(type);
  const [nextFields, setNextFields] = useState<NoteFields>(parseFields(fields));
  const [saving, setSaving] = useState(false);

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-3">
      <TemplateFields
        type={nextType}
        fields={nextFields}
        onChange={(partial) => setNextFields((current) => ({ ...current, ...partial }))}
      />
      <div className="flex gap-2">
        <Button
          className="flex-1 rounded-full"
          disabled={saving}
          onClick={async () => {
            let fieldsToSave = nextFields;
            if (nextType === "choice") {
              const sanitized = sanitizeChoiceFields(nextFields);
              if (!sanitized) return;
              fieldsToSave = { ...nextFields, ...sanitized };
            }
            setSaving(true);
            await onSave({ type: nextType, fields: fieldsToSave as Json, layout });
            setSaving(false);
          }}
        >
          保存修改
        </Button>
        <Button variant="ghost" className="rounded-full" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}

export function resetFields(type: NoteType) {
  return emptyFields(type);
}
