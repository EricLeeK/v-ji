"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { localDateKey } from "@/lib/dates";
import { reminderDue, reminderStorageKey } from "@/lib/reminder";
import type { UserSettings } from "@/lib/settings";

export function StudyReminder({ ownerId, reminder }: { ownerId: string; reminder: UserSettings["reminder"] }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/study")) return;
    let current = { enabled: reminder.enabled, time: reminder.time };
    let lastDay: string | null = null;
    const key = reminderStorageKey(ownerId);
    const readLastDay = () => { try { lastDay = localStorage.getItem(key) ?? lastDay; } catch { /* In-memory deduplication still works. */ } };
    readLastDay();
    async function notify() {
      const options = { body: "今天也花几分钟，复习一下你的卡片吧。", tag: "vji-study-reminder", icon: "/icons/sprout-192.png" };
      toast("到学习时间了", { description: options.body, duration: 15_000, action: { label: "开始学习", onClick: () => router.push("/study") } });
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      try {
        const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
        if (registration) await registration.showNotification("V 记 · 学习提醒", options);
        else {
          const notification = new Notification("V 记 · 学习提醒", options);
          notification.onclick = () => { window.focus(); notification.close(); router.push("/study"); };
        }
      } catch { /* The visible in-app reminder remains available. */ }
    }
    function tick() {
      if (document.hidden && (!("Notification" in window) || Notification.permission !== "granted")) return;
      readLastDay();
      const now = new Date();
      if (!reminderDue(current, now, lastDay)) return;
      lastDay = localDateKey(now);
      try { localStorage.setItem(key, lastDay); } catch { /* Storage is optional. */ }
      void notify();
    }
    const update = (event: Event) => { current = (event as CustomEvent<UserSettings["reminder"]>).detail; tick(); };
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener("vji:reminder-settings", update);
    document.addEventListener("visibilitychange", tick);
    tick();
    return () => { window.clearInterval(timer); window.removeEventListener("vji:reminder-settings", update); document.removeEventListener("visibilitychange", tick); };
  }, [ownerId, reminder.enabled, reminder.time, router, pathname]);
  return null;
}
