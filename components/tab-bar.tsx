"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Sun, UserRound, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/today", label: "今日", icon: Sun },
  { href: "/decks", label: "卡片", icon: BookOpen },
  { href: "/library", label: "社区", icon: Compass },
  { href: "/me", label: "我的", icon: UserRound },
];

export function TabBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/study")) return null;
  return (
    <>
    <div aria-hidden className="h-[calc(5.5rem+env(safe-area-inset-bottom))] shrink-0" />
    <nav aria-label="主导航" className="app-tabbar fixed bottom-3 left-1/2 z-20 w-[calc(100%-1.5rem)] max-w-[406px] -translate-x-1/2 rounded-3xl px-1.5 pt-1.5 pb-[max(0.55rem,env(safe-area-inset-bottom))]">
      <ul className="grid grid-cols-4 gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                prefetch={true}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.97]",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active ? <span aria-hidden className="pointer-events-none absolute inset-1 rounded-2xl bg-primary/10" /> : null}
                <Icon className={cn("relative size-5", active && "stroke-[2.4]")} />
                <span className="relative">{tab.label}</span>
                <NavigationPending />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
    </>
  );
}

function NavigationPending() {
  const { pending } = useLinkStatus();
  return pending ? <span role="status" className="absolute right-2 top-2 text-primary"><LoaderCircle className="size-3 animate-spin" /><span className="sr-only">正在打开页面</span></span> : null;
}
