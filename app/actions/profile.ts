"use server";

import { revalidatePath } from "next/cache";
import {
  maskSecret,
  normalizeDeepseekApiKey,
  overlayUserSettings,
  withDeepseekApiKey,
} from "@/lib/ai/provider";
import { validateSettings, type UserSettings } from "@/lib/settings";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getAvatarPreset } from "@/lib/avatar-presets";

export async function updateProfile(patch: { nickname?: string; settings?: UserSettings; avatarId?: string | null }) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const next: { nickname?: string; settings?: ReturnType<typeof overlayUserSettings>; avatar_url?: string | null } = {};
  if (patch.avatarId !== undefined) {
    const preset = getAvatarPreset(patch.avatarId);
    if (patch.avatarId !== null && !preset) return { error: "请选择预设头像" };
    next.avatar_url = preset?.src ?? null;
  }
  if (patch.nickname !== undefined) {
    if (typeof patch.nickname !== "string" || !patch.nickname.trim() || patch.nickname.trim().length > 40) return { error: "昵称须为 1–40 个字符" };
    next.nickname = patch.nickname.trim();
  }
  const { data: profile, error: readError } = await supabase.from("profiles").select("settings, updated_at").eq("id", uid).single();
  if (readError) return { error: "无法读取当前设置，请重试" };
  if (patch.settings) {
    const invalid = Object.values(validateSettings(patch.settings))[0];
    if (invalid) return { error: invalid };
    next.settings = overlayUserSettings(profile.settings, patch.settings);
  }
  const { data, error } = await supabase.from("profiles").update(next).eq("id", uid).eq("updated_at", profile.updated_at).select("id").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "设置刚刚在另一处更新，请刷新后再保存" };
  revalidatePath("/me");
  revalidatePath("/me/settings");
  revalidatePath("/today");
  revalidatePath("/study");
  return {};
}

export async function saveDeepseekApiKey(apiKey: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const parsed = normalizeDeepseekApiKey(apiKey);
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createClient();
  const { data, error: readError } = await supabase.from("profiles").select("settings, updated_at").eq("id", uid).single();
  if (readError) return { error: "无法读取当前设置，请重试" };
  const { data: saved, error } = await supabase
    .from("profiles")
    .update({ settings: withDeepseekApiKey(data?.settings, parsed.key) })
    .eq("id", uid).eq("updated_at", data.updated_at).select("id").maybeSingle();
  if (error) return { error: error.message };
  if (!saved) return { error: "设置刚刚在另一处更新，请刷新后再保存" };
  revalidatePath("/me/settings");
  revalidatePath("/ai/new");
  return { masked: maskSecret(parsed.key) };
}

export async function clearDeepseekApiKey() {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { data, error: readError } = await supabase.from("profiles").select("settings, updated_at").eq("id", uid).single();
  if (readError) return { error: "无法读取当前设置，请重试" };
  const { data: saved, error } = await supabase
    .from("profiles")
    .update({ settings: withDeepseekApiKey(data?.settings, null) })
    .eq("id", uid).eq("updated_at", data.updated_at).select("id").maybeSingle();
  if (error) return { error: error.message };
  if (!saved) return { error: "设置刚刚在另一处更新，请刷新后再保存" };
  revalidatePath("/me/settings");
  revalidatePath("/ai/new");
  return {};
}

export async function submitFeedback(content: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 2000) return { error: "反馈内容需为 1–2000 个字" };
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({ owner_id: uid, content: trimmed });
  if (error) return { error: error.message };
  return {};
}
