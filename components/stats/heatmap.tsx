import { heatLevel, type HeatDay } from "@/lib/heatmap";
import { cn } from "@/lib/utils";

const LEVELS = [
  "bg-muted",
  "bg-primary/30",
  "bg-primary/60",
  "bg-primary",
];

export function Heatmap({ days }: { days: HeatDay[] }) {
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
                <div
                  key={day.date}
                  title={`${day.date} · ${day.count} 次`}
                  className={cn("size-3 rounded-[3px]", LEVELS[heatLevel(day.count)])}
                />
              );
            })}
          </div>
        ))}
      </div>
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
