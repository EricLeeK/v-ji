"use client";

import { useState } from "react";
import { updateProfile } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { GestureAction, UserSettings } from "@/lib/settings";
import { useSpeech } from "@/lib/hooks/use-speech";
import { toast } from "sonner";

const GESTURES: GestureAction[] = ["again", "hard", "good", "easy"];
const GESTURE_LABEL: Record<GestureAction, string> = {
  again: "忘记",
  hard: "困难",
  good: "记得",
  easy: "简单",
};

export function SettingsForm({
  nickname,
  settings,
}: {
  nickname: string;
  settings: UserSettings;
}) {
  const [form, setForm] = useState({ nickname, settings });
  const [pending, setPending] = useState(false);
  const { voices } = useSpeech(form.settings.tts);

  async function save() {
    setPending(true);
    const result = await updateProfile(form);
    setPending(false);
    if (result.error) toast.error(result.error);
    else toast.success("设置已保存");
  }

  async function requestNotify() {
    if (!("Notification" in window)) {
      toast.error("当前浏览器不支持通知");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error("未授予通知权限");
      return;
    }
    toast.success(`将在每天 ${form.settings.reminder.time} 提醒（需保持页面或已安装 PWA）`);
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="space-y-2 rounded-3xl bg-white p-4">
        <Label>昵称</Label>
        <Input
          value={form.nickname}
          onChange={(e) => setForm((c) => ({ ...c, nickname: e.target.value }))}
        />
      </section>

      <section className="space-y-3 rounded-3xl bg-white p-4">
        <p className="text-sm font-medium">手势映射</p>
        <SelectRow
          label="左滑"
          value={form.settings.gesture.left}
          onChange={(left) =>
            setForm((c) => ({ ...c, settings: { ...c.settings, gesture: { ...c.settings.gesture, left } } }))
          }
        />
        <SelectRow
          label="右滑"
          value={form.settings.gesture.right}
          onChange={(right) =>
            setForm((c) => ({ ...c, settings: { ...c.settings, gesture: { ...c.settings.gesture, right } } }))
          }
        />
      </section>

      <section className="space-y-3 rounded-3xl bg-white p-4">
        <p className="text-sm font-medium">朗读</p>
        <Field label="语言">
          <Input
            value={form.settings.tts.lang}
            onChange={(e) =>
              setForm((c) => ({
                ...c,
                settings: { ...c.settings, tts: { ...c.settings.tts, lang: e.target.value } },
              }))
            }
          />
        </Field>
        <Field label="音色">
          <select
            className="w-full rounded-xl border bg-background px-2 py-2 text-sm"
            value={form.settings.tts.voice}
            onChange={(e) =>
              setForm((c) => ({
                ...c,
                settings: { ...c.settings, tts: { ...c.settings.tts, voice: e.target.value } },
              }))
            }
          >
            <option value="">系统默认</option>
            {voices.map((voice) => (
              <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </Field>
        <Field label={`语速 ${form.settings.tts.rate.toFixed(1)}`}>
          <input
            type="range"
            min={0.6}
            max={1.4}
            step={0.1}
            value={form.settings.tts.rate}
            onChange={(e) =>
              setForm((c) => ({
                ...c,
                settings: { ...c.settings, tts: { ...c.settings.tts, rate: Number(e.target.value) } },
              }))
            }
            className="w-full"
          />
        </Field>
      </section>

      <section className="space-y-3 rounded-3xl bg-white p-4">
        <p className="text-sm font-medium">学习计划</p>
        <Field label={`目标记忆率 ${(form.settings.requestRetention * 100).toFixed(0)}%`}>
          <input
            type="range"
            min={0.8}
            max={0.97}
            step={0.01}
            value={form.settings.requestRetention}
            onChange={(e) =>
              setForm((c) => ({
                ...c,
                settings: { ...c.settings, requestRetention: Number(e.target.value) },
              }))
            }
            className="w-full"
          />
        </Field>
        <Field label="每日新卡上限">
          <Input
            type="number"
            min={0}
            max={200}
            value={form.settings.newCardsPerDay}
            onChange={(e) =>
              setForm((c) => ({
                ...c,
                settings: { ...c.settings, newCardsPerDay: Number(e.target.value) },
              }))
            }
          />
        </Field>
      </section>

      <section className="space-y-3 rounded-3xl bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">每日学习提醒</p>
          <Switch
            checked={form.settings.reminder.enabled}
            onCheckedChange={(enabled) =>
              setForm((c) => ({
                ...c,
                settings: { ...c.settings, reminder: { ...c.settings.reminder, enabled } },
              }))
            }
          />
        </div>
        <Input
          type="time"
          value={form.settings.reminder.time}
          onChange={(e) =>
            setForm((c) => ({
              ...c,
              settings: { ...c.settings, reminder: { ...c.settings.reminder, time: e.target.value } },
            }))
          }
        />
        <Button type="button" variant="outline" className="w-full rounded-full" onClick={requestNotify}>
          授权浏览器通知
        </Button>
      </section>

      <Button className="h-11 w-full rounded-full" disabled={pending} onClick={save}>
        保存设置
      </Button>
    </div>
  );
}

function SelectRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: GestureAction;
  onChange: (value: GestureAction) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <select
        className="rounded-xl border bg-background px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value as GestureAction)}
      >
        {GESTURES.map((item) => (
          <option key={item} value={item}>
            {GESTURE_LABEL[item]}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
