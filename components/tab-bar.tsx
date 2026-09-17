"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Sun, UserRound } from "lucide-react";
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
    <nav className="sticky bottom-0 z-20 border-t border-border/80 bg-card/95 px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur">
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.4]")} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
