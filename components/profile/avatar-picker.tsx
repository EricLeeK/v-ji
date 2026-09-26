"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronRight, Pencil } from "lucide-react";
import { ProfileAvatar } from "@/components/profile/profile-avatar";

const AvatarPickerPanel = dynamic(() => import("./avatar-picker-panel"), { ssr: false });

export function AvatarPicker({ avatarUrl, nickname, variant = "avatar" }: {
  avatarUrl?: string | null;
  nickname: string;
  variant?: "avatar" | "row";
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const row = variant === "row";

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="更换头像"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={row
          ? "flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary"
          : "group relative size-16 shrink-0 rounded-[22px] text-xl outline-none ring-8 ring-primary/5 transition-transform active:scale-95 focus-visible:ring-primary/30"}
      >
        <ProfileAvatar src={avatarUrl} nickname={nickname} className={row ? "size-12! rounded-2xl text-lg" : "rounded-[22px]"} />
        {row ? (
          <>
            <span className="flex-1"><span className="block text-sm font-medium">更换头像</span><span className="mt-1 block text-xs text-muted-foreground">十二生肖 · 中华好味</span></span>
            <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
          </>
        ) : (
          <span aria-hidden="true" className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm"><Pencil className="size-3" /></span>
        )}
      </button>
      {open ? <AvatarPickerPanel avatarUrl={avatarUrl ?? null} nickname={nickname} onClose={() => setOpen(false)} onCloseAutoFocus={() => trigger.current?.focus()} /> : null}
    </>
  );
}
