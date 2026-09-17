"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_CHOICE_OPTIONS,
  MIN_CHOICE_OPTIONS,
  addChoiceOption,
  removeChoiceOption,
  setChoiceOptionText,
  type NoteFields,
} from "@/lib/templates";
import { cn } from "@/lib/utils";

export function ChoiceEditor({
  fields,
  onChange,
}: {
  fields: NoteFields;
  onChange: (partial: NoteFields) => void;
}) {
  const options = fields.options ?? [];

  return (
    <div className="space-y-3">
      <label className="block space-y-1.5">
        <Label>题干</Label>
        <Textarea
          value={fields.stem ?? ""}
          onChange={(event) => onChange({ stem: event.target.value })}
          rows={3}
          placeholder="例如：下列哪项属于间隔重复算法？"
        />
      </label>
      <div className="space-y-2">
        <Label>选项（点选字母标出正确答案）</Label>
        {options.map((option) => {
          const selected = fields.answer === option.key;
          return (
            <div key={option.key} className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`设 ${option.key} 为正确答案`}
                onClick={() => onChange({ answer: option.key })}
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                {option.key}
              </button>
              <Input
                value={option.text}
                placeholder={`选项 ${option.key}`}
                onChange={(event) =>
                  onChange({
                    options: setChoiceOptionText(options, option.key, event.target.value),
                  })
                }
              />
              {options.length > MIN_CHOICE_OPTIONS ? (
                <button
                  type="button"
                  aria-label={`删除选项 ${option.key}`}
                  onClick={() =>
                    onChange(removeChoiceOption({ options, answer: fields.answer }, option.key))
                  }
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>
          );
        })}
        {options.length < MAX_CHOICE_OPTIONS ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-full"
            onClick={() => onChange(addChoiceOption({ options, answer: fields.answer }))}
          >
            <Plus className="mr-1 size-4" />
            添加选项
          </Button>
        ) : null}
      </div>
      <label className="block space-y-1.5">
        <Label>解析（可选）</Label>
        <Textarea
          value={fields.explain ?? ""}
          onChange={(event) => onChange({ explain: event.target.value })}
          rows={3}
          placeholder="为什么选这个答案"
        />
      </label>
    </div>
  );
}
