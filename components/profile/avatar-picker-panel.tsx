"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/profile";
import { AVATAR_PRESETS, getAvatarPreset } from "@/lib/avatar-presets";
import { useAction } from "@/lib/hooks/use-action";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

const GROUPS = [
  { id: "zodiac", title: "十二生肖", count: "12 位小伙伴" },
  { id: "food", title: "中华好味", count: "6 份小确幸" },
] as const;

export default function AvatarPickerPanel({ avatarUrl, nickname, onClose, onCloseAutoFocus }: {
  avatarUrl: string | null;
  nickname: string;
  onClose: () => void;
  onCloseAutoFocus: () => void;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  // undefined preserves a pre-existing external avatar until the user chooses.
  const [selectedId, setSelectedId] = useState<string | null | undefined>(() =>
    avatarUrl ? AVATAR_PRESETS.find(avatar => avatar.src === avatarUrl)?.id : null,
  );
  const selected = getAvatarPreset(selectedId);
  const previewUrl = selectedId === undefined ? avatarUrl : selected?.src ?? null;
  const dirty = previewUrl !== avatarUrl;

  function save() {
    if (!dirty || selectedId === undefined) return;
    void run(() => updateProfile({ avatarId: selectedId }), () => {
      toast.success("头像已更新");
      onClose();
      router.refresh();
    });
  }

  return (
    <Sheet open onOpenChange={open => { if (!open && !pending) onClose(); }}>
      <SheetContent
        side="bottom"
        showCloseButton={!pending}
        className="mx-auto max-h-[90dvh] max-w-lg gap-0 rounded-t-[30px] border-0 bg-[#f8f8f3] p-0"
        onCloseAutoFocus={event => { event.preventDefault(); onCloseAutoFocus(); }}
      >
        <div className="shrink-0 px-6 pt-5 pb-4">
          <div aria-hidden="true" className="mx-auto mb-5 h-1 w-9 rounded-full bg-foreground/10" />
          <div className="flex items-center gap-4">
            <ProfileAvatar src={previewUrl} nickname={nickname} className="size-16! rounded-[22px] text-2xl shadow-sm" />
            <div>
              <SheetTitle className="text-xl font-semibold tracking-tight">选一位小伙伴</SheetTitle>
              <SheetDescription className="mt-1 text-xs">陪你记住每一点进步</SheetDescription>
              <p aria-live="polite" className="mt-2 text-xs font-medium text-primary">{selected?.name ?? (selectedId === null ? "昵称头像" : "当前头像")}</p>
            </div>
          </div>
        </div>

        <div data-avatar-scroll className="min-h-0 overflow-y-auto overscroll-contain">
        <fieldset disabled={pending} aria-label="预设头像" className="min-w-0 space-y-5 px-6 pt-1 pb-5 disabled:opacity-60">
          {GROUPS.map(group => (
            <section key={group.id} aria-labelledby={`avatar-${group.id}`}>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h3 id={`avatar-${group.id}`} className="text-sm font-semibold">{group.title}</h3>
                <span className="text-[11px] text-muted-foreground">{group.count}</span>
              </div>
              <div className="grid grid-cols-4 gap-x-3 gap-y-3 min-[400px]:grid-cols-6">
                {AVATAR_PRESETS.filter(avatar => avatar.category === group.id).map(avatar => (
                  <label key={avatar.id} className="relative min-w-0 cursor-pointer text-center">
                    <input
                      type="radio"
                      name="preset-avatar"
                      value={avatar.id}
                      checked={selectedId === avatar.id}
                      onChange={() => setSelectedId(avatar.id)}
                      aria-label={`${avatar.name}头像`}
                      className="peer sr-only"
                    />
                    <span className="relative block aspect-square rounded-[20px] ring-offset-3 ring-offset-[#f8f8f3] transition-transform peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-5 peer-focus-visible:outline-primary active:scale-95">
                      <ProfileAvatar src={avatar.src} nickname={avatar.name} loading="lazy" className="rounded-[20px]" />
                      {selectedId === avatar.id ? <span aria-hidden="true" className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-[#f8f8f3] bg-primary text-white"><Check className="size-3" strokeWidth={3} /></span> : null}
                    </span>
                    <span className="mt-2 block truncate text-[11px] text-muted-foreground peer-checked:font-semibold peer-checked:text-primary">{avatar.name}</span>
                  </label>
                ))}
              </div>
            </section>
          ))}
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input type="radio" name="preset-avatar" value="default" checked={selectedId === null} onChange={() => setSelectedId(null)} className="size-4 accent-primary" />
            使用昵称首字
          </label>
        </fieldset>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-border/60 bg-[#f8f8f3] px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]" aria-busy={pending}>
          <Button type="button" variant="outline" className="h-11 rounded-full px-6" disabled={pending} onClick={onClose}>取消</Button>
          <Button type="button" className="h-11 flex-1 rounded-full" disabled={!dirty || pending} onClick={save}>
            {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : null}
            {pending ? "保存中…" : "保存头像"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
