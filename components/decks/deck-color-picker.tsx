"use client";

import { DECK_COLORS, DECK_COLOR_LABELS, type DeckColor } from "@/lib/deck-tone";
import { cn } from "@/lib/utils";

export function DeckColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: DeckColor;
  onChange: (color: DeckColor) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="卡片盒颜色">
      {DECK_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          data-tone={color}
          aria-label={DECK_COLOR_LABELS[color]}
          aria-pressed={value === color}
          disabled={disabled}
          onClick={() => onChange(color)}
          className={cn(
            "size-9 rounded-full bg-[var(--tone-surface)] ring-1 ring-[var(--tone-border)] transition-transform",
            value === color ? "scale-110 ring-2 ring-[var(--tone-ink)]" : "hover:scale-105",
          )}
        />
      ))}
    </div>
  );
}
