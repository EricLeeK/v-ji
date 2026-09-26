"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Volume2, Square } from "lucide-react";
import { updateProfile } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { validateSettings, type GestureAction, type UserSettings } from "@/lib/settings";
import { useSpeech } from "@/lib/hooks/use-speech";
import { toast } from "sonner";

const GESTURES: GestureAction[] = ["again", "hard", "good", "easy"];
const GESTURE_LABEL: Record<GestureAction, string> = { again: "忘记", hard: "困难", good: "记得", easy: "简单" };

export function SettingsForm({ nickname, settings }: { nickname: string; settings: UserSettings }) {
  const router = useRouter();
  const [form, setForm] = useState({ nickname, settings });
  const [limit, setLimit] = useState(String(settings.newCardsPerDay));
  const [saved, setSaved] = useState(JSON.stringify({ nickname, settings }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [permission, setPermission] = useState<string>("unknown");
  const [notifying, setNotifying] = useState(false);
  const { voices, speak, cancel, speaking, supported } = useSpeech(form.settings.tts);
  const draft = { ...form, settings: { ...form.settings, newCardsPerDay: limit.trim() ? Number(limit) : NaN } };
  const dirty = JSON.stringify(draft) !== saved;
  const availableVoices = voices.filter(voice => voice.lang.toLowerCase().startsWith(form.settings.tts.lang.split("-")[0].toLowerCase()));

  useEffect(() => {
    const sync = () => setPermission("Notification" in window ? Notification.permission : "unsupported");
    sync();
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  async function save() {
    if (lock.current) return;
    const invalid = validateSettings(draft.settings);
    if (!draft.nickname.trim() || draft.nickname.trim().length > 40) invalid.nickname = "昵称须为 1–40 个字符";
    setErrors(invalid);
    if (Object.keys(invalid).length) { toast.error(Object.values(invalid)[0]); return; }
    lock.current = true;
    setPending(true);
    try {
      const normalized = { ...draft, nickname: draft.nickname.trim() };
      const result = await updateProfile(normalized);
      if (result.error) { toast.error(result.error); return; }
      setForm(normalized);
      setLimit(String(normalized.settings.newCardsPerDay));
      setSaved(JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent("vji:reminder-settings", { detail: normalized.settings.reminder }));
      router.refresh();
      toast.success("设置已保存，下次学习将使用新设置");
    } catch { toast.error("保存失败，请检查网络后重试；修改内容已保留"); }
    finally { lock.current = false; setPending(false); }
  }

  async function requestNotify() {
    if (!("Notification" in window)) { toast.info("当前浏览器不支持系统通知，仍可使用页面内提醒"); return; }
    setNotifying(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") toast.success("已授权。开启提醒并保存后，页面打开时会提醒你");
      else toast.info(result === "denied" ? "通知已被浏览器阻止，可在网站权限中开启；页面内提醒仍可用" : "暂未授权，页面内提醒仍可用");
    } catch { toast.error("无法申请通知权限，请检查浏览器的网站权限"); }
    finally { setNotifying(false); }
  }

  const patchTts = (patch: Partial<UserSettings["tts"]>) => setForm(c => ({ ...c, settings: { ...c.settings, tts: { ...c.settings.tts, ...patch } } }));
  return (
    <form className="space-y-5 pb-8" noValidate onSubmit={event => { event.preventDefault(); void save(); }} aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-5 disabled:opacity-70">
        <section id="profile" className="scroll-mt-6 space-y-2 rounded-3xl bg-white p-4">
          <Field label="昵称" error={errors.nickname}>
            <Input id="settings-nickname" autoComplete="nickname" maxLength={40} value={form.nickname} aria-invalid={!!errors.nickname} onChange={e => setForm(c => ({ ...c, nickname: e.target.value }))} />
          </Field>
        </section>

        <section className="space-y-3 rounded-3xl bg-white p-4">
          <h2 className="text-sm font-medium">手势映射</h2>
          {(["left", "right"] as const).map(side => <label key={side} className="flex items-center justify-between gap-3 text-sm">
            <span>{side === "left" ? "左滑" : "右滑"}</span>
            <select className="min-h-10 rounded-xl border bg-background px-3 text-base" value={form.settings.gesture[side]} onChange={event => setForm(c => ({ ...c, settings: { ...c.settings, gesture: { ...c.settings.gesture, [side]: event.target.value as GestureAction } } }))}>
              {GESTURES.map(value => <option key={value} value={value}>{GESTURE_LABEL[value]}</option>)}
            </select>
          </label>)}
          <p className="text-xs leading-5 text-muted-foreground">查看答案后滑动评分；学习页也可以使用四档评分按钮。</p>
        </section>

        <section className="space-y-3 rounded-3xl bg-white p-4">
          <h2 className="text-sm font-medium">朗读</h2>
          <Field label="语言" error={errors.lang}><Input value={form.settings.tts.lang} placeholder="zh-CN / en-US" aria-invalid={!!errors.lang} onChange={e => patchTts({ lang: e.target.value, voice: "" })} /></Field>
          <Field label="音色">
            <select className="min-h-11 w-full rounded-xl border bg-background px-2 text-base" value={form.settings.tts.voice} disabled={!supported} onChange={e => patchTts({ voice: e.target.value })}>
              <option value="">系统默认</option>
              {form.settings.tts.voice && !availableVoices.some(v => v.name === form.settings.tts.voice) ? <option value={form.settings.tts.voice}>{form.settings.tts.voice}（本机未安装）</option> : null}
              {availableVoices.map(voice => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} ({voice.lang})</option>)}
            </select>
          </Field>
          <Field label={`语速 ${form.settings.tts.rate.toFixed(1)}`} error={errors.rate}><input aria-label="语速" type="range" min={0.6} max={1.4} step={0.1} value={form.settings.tts.rate} onChange={e => patchTts({ rate: Number(e.target.value) })} className="h-8 w-full accent-primary" /></Field>
          <Button type="button" variant="outline" className="min-h-10 w-full rounded-full" onClick={() => speaking ? cancel() : speak(form.settings.tts.lang.startsWith("en") ? "Welcome to V Ji. A little practice every day." : "欢迎使用 V 记，每天进步一点点。")}>{speaking ? <Square className="size-4" /> : <Volume2 className="size-4" />}{speaking ? "停止试听" : "试听朗读"}</Button>
          {!supported ? <p className="text-xs leading-5 text-muted-foreground">当前浏览器暂无系统朗读支持，设置仍可保存供其他设备使用。</p> : null}
        </section>

        <section id="plan" className="scroll-mt-6 space-y-3 rounded-3xl bg-white p-4">
          <h2 className="text-sm font-medium">学习计划</h2>
          <Field label={`目标记忆率 ${(form.settings.requestRetention * 100).toFixed(0)}%`} error={errors.requestRetention}><input aria-label="目标记忆率" type="range" min={0.8} max={0.97} step={0.01} value={form.settings.requestRetention} onChange={e => setForm(c => ({ ...c, settings: { ...c.settings, requestRetention: Number(e.target.value) } }))} className="h-8 w-full accent-primary" /></Field>
          <Field label="每日新卡上限" error={errors.newCardsPerDay}><Input type="number" inputMode="numeric" min={0} max={200} step={1} value={limit} aria-invalid={!!errors.newCardsPerDay} onChange={e => setLimit(e.target.value)} /></Field>
          <p className="text-xs leading-5 text-muted-foreground">设为 0 时，今日任务只安排到期复习；从卡片盒进入学习仍可加练新卡。</p>
        </section>

        <section id="reminder" className="scroll-mt-6 space-y-3 rounded-3xl bg-white p-4">
          <div className="flex items-center justify-between gap-3"><label htmlFor="study-reminder" className="text-sm font-medium">每日学习提醒</label><Switch id="study-reminder" checked={form.settings.reminder.enabled} onCheckedChange={enabled => setForm(c => ({ ...c, settings: { ...c.settings, reminder: { ...c.settings.reminder, enabled } } }))} /></div>
          <Field label="提醒时间" error={errors.time}><Input type="time" disabled={!form.settings.reminder.enabled} value={form.settings.reminder.time} onChange={e => setForm(c => ({ ...c, settings: { ...c.settings, reminder: { ...c.settings.reminder, time: e.target.value } } }))} /></Field>
          <p className="text-xs leading-5 text-muted-foreground">页面保持打开时，到点会显示提醒；关闭网页或退出 PWA 后暂不支持后台推送。修改后请保存。</p>
          <Button type="button" variant="outline" className="min-h-10 w-full rounded-full" disabled={notifying || permission === "granted" || permission === "unsupported"} onClick={() => void requestNotify()}>{notifying ? "正在申请…" : permission === "granted" ? "浏览器通知已授权" : permission === "unsupported" ? "当前浏览器仅支持页面内提醒" : "授权浏览器通知"}</Button>
        </section>
      </fieldset>
      <div className="space-y-2">
        <p role="status" className="text-center text-xs text-muted-foreground">{pending ? "正在保存…" : dirty ? "有未保存的更改" : "设置已保存"}</p>
        <Button type="submit" className="h-11 w-full rounded-full" disabled={pending || !dirty}>{pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : null}{pending ? "保存中…" : "保存设置"}</Button>
      </div>
    </form>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return <label className="block space-y-1.5 text-sm"><span className="text-muted-foreground">{label}</span>{children}{error ? <span role="alert" className="block text-xs text-destructive">{error}</span> : null}</label>;
}
