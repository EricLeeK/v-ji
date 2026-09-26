"use client";

import { useState } from "react";
import { heatLevel, type HeatDay } from "@/lib/heatmap";
import { cn } from "@/lib/utils";

const LEVELS = [
  "bg-muted",
  "bg-primary/30",
  "bg-primary/60",
  "bg-primary",
];

export function Heatmap({ days }: { days: HeatDay[] }) {
  const [selected, setSelected] = useState<HeatDay | null>(null);
  const weeks = Math.ceil(days.length / 7);
  return (
    <div className="rounded-3xl bg-white p-4">
      <p className="mb-3 text-sm font-medium">学习热力图</p>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {Array.from({ length: weeks }).map((_, week) => (
          <div key={week} className="flex flex-col gap-1">
            {Array.from({ length: 7 }).map((__, weekday) => {
              const day = days[week * 7 + weekday];
              if (!day) return <div key={weekday} className="size-3" />;
              return (
                <button
                  type="button"
                  aria-label={`${day.date} · ${day.count} 次复习`}
                  aria-pressed={selected?.date === day.date}
                  onClick={() => setSelected(day)}
                  key={day.date}
                  title={`${day.date} · ${day.count} 次`}
                  className={cn("size-3 rounded-[3px]", LEVELS[heatLevel(day.count)], selected?.date === day.date && "ring-2 ring-foreground ring-offset-1")}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p role="status" className="mt-2 text-xs text-muted-foreground">{selected ? `${selected.date} · 复习 ${selected.count} 次` : "点击方格查看当天的复习次数"}</p>
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        少
        {LEVELS.map((cls) => (
          <span key={cls} className={cn("size-3 rounded-[3px]", cls)} />
        ))}
        多
      </div>
    </div>
  );
}
