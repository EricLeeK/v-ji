import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const STEPS = ["读取资料", "整理知识点", "生成卡片", "检查结果"] as const;

export function JobProgress({
  status,
  detail,
  progress,
}: {
  status: string;
  detail?: string;
  progress?: number;
}) {
  const current = stepIndex(status);
  return (
    <div className="space-y-4">
      <Progress value={progress ?? (current / STEPS.length) * 100} />
      <ol className="space-y-2">
        {STEPS.map((label, index) => {
          const done = index < current || status === "ready" || status === "imported";
          const active = index === current && status !== "ready" && status !== "failed";
          return (
            <li key={label} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-[11px]",
                  done ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  active && "border-primary text-primary",
                )}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className={active ? "font-medium" : "text-muted-foreground"}>{label}</span>
            </li>
          );
        })}
      </ol>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      {status === "failed" ? <p className="text-sm text-destructive">{detail || "生成失败"}</p> : null}
    </div>
  );
}

function stepIndex(status: string) {
  if (status === "organizing") return 1;
  if (status === "generating") return 2;
  if (status === "checking") return 3;
  if (status === "ready" || status === "imported") return 4;
  return 0;
}
