"use client";

import type { ReactNode } from "react";
import { TEMPLATES } from "@/lib/templates";
import type { AiGenerateSettings, CardLayout } from "@/lib/ai/schemas";
import type { NoteType } from "@/types/database";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type DeckOption = { id: string; name: string };

export function GenerateSettingsSheet({
  open,
  onOpenChange,
  settings,
  onChange,
  decks,
  deckId,
  newDeckName,
  onDeckId,
  onNewDeckName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AiGenerateSettings;
  onChange: (settings: AiGenerateSettings) => void;
  decks: DeckOption[];
  deckId?: string;
  newDeckName: string;
  onDeckId: (id: string | undefined) => void;
  onNewDeckName: (name: string) => void;
}) {
  const selected = settings.types === "auto" ? [] : settings.types;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>生成设置</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <section>
            <Label>卡片类型</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip
                active={settings.types === "auto"}
                onClick={() => onChange({ ...settings, types: "auto" })}
              >
                AI 自动搭配
              </Chip>
              {TEMPLATES.map((item) => (
                <Chip
                  key={item.type}
                  active={selected.includes(item.type)}
                  onClick={() => {
                    const next = selected.includes(item.type)
                      ? selected.filter((type) => type !== item.type)
                      : [...selected, item.type];
                    onChange({ ...settings, types: next.length ? (next as NoteType[]) : "auto" });
                  }}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </section>
          <section>
            <Label>内容范围</Label>
            <div className="mt-2 flex gap-2">
              <Chip active={settings.coverage === "core"} onClick={() => onChange({ ...settings, coverage: "core" })}>
                核心知识点
              </Chip>
              <Chip active={settings.coverage === "full"} onClick={() => onChange({ ...settings, coverage: "full" })}>
                全面覆盖
              </Chip>
            </div>
          </section>
          <section>
            <Label>生成数量</Label>
            <div className="mt-2 flex items-center gap-2">
              <Chip
                active={settings.cardLimit === "auto"}
                onClick={() => onChange({ ...settings, cardLimit: "auto" })}
              >
                自动决定
              </Chip>
              <Input
                type="number"
                min={1}
                max={100}
                className="h-9 w-24"
                placeholder="上限"
                value={settings.cardLimit === "auto" ? "" : settings.cardLimit}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    cardLimit: event.target.value ? Number(event.target.value) : "auto",
                  })
                }
              />
            </div>
          </section>
          <section>
            <Label>答案详细度</Label>
            <div className="mt-2 flex gap-2">
              {(["brief", "standard", "detailed"] as const).map((item) => (
                <Chip key={item} active={settings.detail === item} onClick={() => onChange({ ...settings, detail: item })}>
                  {item === "brief" ? "简明" : item === "standard" ? "标准" : "详细"}
                </Chip>
              ))}
            </div>
          </section>
          <section>
            <Label>内容依据</Label>
            <div className="mt-2 flex flex-col gap-2">
              <Chip
                active={settings.grounding === "source_only"}
                onClick={() => onChange({ ...settings, grounding: "source_only" })}
              >
                仅根据资料
              </Chip>
              <Chip
                active={settings.grounding === "allow_supplement"}
                onClick={() => onChange({ ...settings, grounding: "allow_supplement" })}
              >
                允许 AI 补充解释
              </Chip>
            </div>
          </section>
          <section>
            <Label>版式</Label>
            <div className="mt-2 flex gap-2">
              {(["auto", "minimal", "emphasis", "illustrated"] as const).map((item) => (
                <Chip
                  key={item}
                  active={settings.layout === item}
                  onClick={() => onChange({ ...settings, layout: item as CardLayout | "auto" })}
                >
                  {item === "auto" ? "自动" : item === "minimal" ? "极简" : item === "emphasis" ? "重点" : "图文"}
                </Chip>
              ))}
            </div>
          </section>
          <section>
            <Label>保存位置</Label>
            <div className="mt-2 space-y-2">
              {decks.map((deck) => (
                <Chip key={deck.id} active={deckId === deck.id} onClick={() => onDeckId(deck.id)}>
                  {deck.name}
                </Chip>
              ))}
              <Chip active={!deckId} onClick={() => onDeckId(undefined)}>
                新建卡片盒
              </Chip>
              {!deckId ? (
                <Input
                  placeholder="新卡片盒名称"
                  value={newDeckName}
                  onChange={(event) => onNewDeckName(event.target.value)}
                />
              ) : null}
            </div>
          </section>
          <Button className="h-11 w-full rounded-full" onClick={() => onOpenChange(false)}>
            完成
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-left text-xs",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground",
      )}
    >
      {children}
    </button>
  );
}
