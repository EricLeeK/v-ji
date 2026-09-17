import { AppIcon } from "@/components/app-icon";
import { PhoneShell } from "@/components/phone-shell";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <PhoneShell showTab={false}>
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-primary/15 text-3xl">
          <AppIcon name="offline" className="size-9 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">当前处于离线</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          学习页需要网络同步复习记录。恢复连接后可以继续今日任务。
        </p>
        <Button asChild className="mt-8 h-11 rounded-full px-8">
          <Link href="/today">回到今日</Link>
        </Button>
      </div>
    </PhoneShell>
  );
}
