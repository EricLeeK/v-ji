import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";

const base = process.env.AVATAR_AUDIT_URL ?? "http://localhost:3102";
const out = "output/playwright/avatars";
await mkdir(out, { recursive: true });
nextEnv.loadEnvConfig(process.cwd());
const cookies = new Map();
const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false },
  cookies: { getAll: () => [...cookies.values()], setAll: entries => entries.forEach(entry => cookies.set(entry.name, entry)) },
});
const checked = result => { if (result.error) throw Error(result.error.message); return result.data; };
const auth = checked(await db.auth.signInWithPassword({ email: "demo@huaji.local", password: "huaji123456" }));
const ownerId = auth.user.id;
const readProfile = async () => checked(await db.from("profiles").select("avatar_url,nickname,settings").eq("id", ownerId).single());
const original = await readProfile();
const fingerprint = profile => createHash("sha256").update(JSON.stringify({ nickname: profile.nickname, settings: profile.settings })).digest("hex");
const imagePath = async locator => new URL(await locator.getAttribute("src"), base).pathname;
const result = { checks: [], errors: [], requests: [], cleanup: false };
const ok = (name, value = true) => { assert.ok(value, name); result.checks.push(name); console.log("PASS", name); };
const browser = await chromium.launch({ channel: "chrome", headless: true });
let savedAvatar = null;
let page;
try {
  const context = await browser.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "zh-CN", serviceWorkers: "allow" });
  await context.addCookies([...cookies.values()].filter(cookie => cookie.value).map(cookie => ({ name: cookie.name, value: cookie.value, url: base, sameSite: "Lax" })));
  page = await context.newPage();
  page.on("pageerror", error => result.errors.push(error.message));
  page.on("request", request => { if (request.url().includes("/avatars/")) result.requests.push(new URL(request.url()).pathname); });
  await page.goto(`${base}/me`);
  await page.getByRole("button", { name: "更换头像", exact: true }).waitFor();
  await page.waitForLoadState("networkidle");
  ok("closed picker does not download the avatar library", result.requests.every(url => url === original.avatar_url));
  await writeFile(`${out}/me-initial.yml`, await page.locator("body").ariaSnapshot());

  await page.getByRole("button", { name: "更换头像", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  ok("all 18 presets plus the nickname fallback are selectable", await dialog.getByRole("radio").count() === 19);
  ok("unchanged avatar cannot be saved", await dialog.getByRole("button", { name: "保存头像", exact: true }).isDisabled());
  await dialog.getByRole("radio", { name: "糯糯兔头像", exact: true }).locator("..").click();
  ok("selection previews without persisting", (await readProfile()).avatar_url === original.avatar_url);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  ok("cancel preserves the stored avatar", (await readProfile()).avatar_url === original.avatar_url);
  ok("closing restores focus to the trigger", await page.getByRole("button", { name: "更换头像", exact: true }).evaluate(element => element === document.activeElement));

  await page.getByRole("button", { name: "更换头像", exact: true }).click();
  await dialog.getByRole("radio", { name: "糯糯兔头像", exact: true }).locator("..").click();
  await dialog.locator("[data-avatar-scroll]").evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: `${out}/picker-mobile-393.png`, scale: "css" });
  await dialog.getByRole("button", { name: "保存头像", exact: true }).click();
  // Set before awaiting the UI so cleanup also runs after a late response failure.
  savedAvatar = "/avatars/v1/rabbit.webp";
  await dialog.waitFor({ state: "hidden" });
  const persisted = await readProfile();
  ok("save persists to the signed-in profile", persisted.avatar_url === savedAvatar);
  ok("avatar-only save preserves nickname and private settings", fingerprint(persisted) === fingerprint(original));
  await page.reload();
  await page.getByRole("button", { name: "更换头像", exact: true }).locator("img").waitFor();
  result.reloadedSrc = await page.getByRole("button", { name: "更换头像", exact: true }).locator("img").getAttribute("src");
  ok("saved avatar survives reload", await imagePath(page.getByRole("button", { name: "更换头像", exact: true }).locator("img")) === savedAvatar);
  await page.screenshot({ path: `${out}/profile-mobile-393.png`, scale: "css" });

  result.requests = [];
  await page.goto(`${base}/today`);
  await page.getByRole("link", { name: "查看个人资料", exact: true }).locator("img").waitFor();
  await page.waitForLoadState("networkidle");
  ok("today displays the persisted avatar", await imagePath(page.getByRole("link", { name: "查看个人资料", exact: true }).locator("img")) === savedAvatar);
  ok("today downloads at most the current avatar", result.requests.every(url => url === savedAvatar));

  await page.goto(`${base}/me/settings`);
  await page.getByRole("button", { name: "更换头像", exact: true }).click();
  await dialog.getByRole("radio", { name: "糯糯兔头像", exact: true }).waitFor();
  ok("settings opens with the saved selection", await dialog.getByRole("radio", { name: "糯糯兔头像", exact: true }).isChecked());
  await dialog.getByRole("radio", { name: "青青粽头像", exact: true }).locator("..").click();
  let actionCount = 0;
  await page.route("**/me/settings", async route => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      actionCount += 1;
      await route.fulfill({ status: 200, contentType: "text/x-component", body: '0:{"a":"$@1","f":"","b":"test"}\n1:{"error":"测试：保存失败，请重试"}\n' });
    } else await route.continue();
  });
  await dialog.getByRole("button", { name: "保存头像", exact: true }).click();
  await page.getByText("测试：保存失败，请重试", { exact: true }).waitFor();
  ok("failed save keeps the selection and allows retry", await dialog.getByRole("radio", { name: "青青粽头像", exact: true }).isChecked() && await dialog.getByRole("button", { name: "保存头像", exact: true }).isEnabled());
  ok("failed save does not change the stored profile", (await readProfile()).avatar_url === savedAvatar && actionCount === 1);
  await page.unroute("**/me/settings");

  for (const width of [320, 430, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await dialog.evaluate(element => ({ width: element.getBoundingClientRect().width, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth }));
    ok(`picker fits ${width}px without horizontal overflow`, layout.width <= width && layout.documentWidth <= width);
    const save = await dialog.getByRole("button", { name: "保存头像", exact: true }).boundingBox();
    ok(`save remains reachable at ${width}px`, save.y >= 0 && save.y + save.height <= 900);
    await dialog.locator("[data-avatar-scroll]").evaluate(element => { element.scrollTop = element.scrollHeight; });
    await dialog.getByRole("radio", { name: "使用昵称首字", exact: true }).check();
    ok(`last choice remains selectable at ${width}px`, await dialog.getByRole("radio", { name: "使用昵称首字", exact: true }).isChecked());
    await dialog.getByRole("radio", { name: "青青粽头像", exact: true }).locator("..").click();
    await dialog.locator("[data-avatar-scroll]").evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: `${out}/picker-${width}.png`, scale: "css" });
  }
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await page.route("**/avatars/v1/rabbit.webp", route => route.abort());
  await page.reload();
  await page.getByRole("button", { name: "更换头像", exact: true }).waitFor();
  await page.waitForLoadState("networkidle");
  ok("failed image load falls back to nickname", await page.getByRole("button", { name: "更换头像", exact: true }).locator("img").count() === 0);
  await page.unroute("**/avatars/v1/rabbit.webp");

  const response = await context.request.get(`${base}/avatars/v1/rabbit.webp`);
  ok("versioned WebP is served with immutable caching", response.ok() && response.headers()["content-type"].includes("image/webp") && response.headers()["cache-control"].includes("immutable"));
  const worker = await context.request.get(`${base}/serwist/sw.js`);
  const sw = await worker.text();
  ok("PWA does not precache the avatar library", worker.ok() && !sw.includes("/avatars/v1/"));
  ok("no unhandled browser exceptions", result.errors.length === 0);
} catch (error) {
  result.failure = error.message;
  if (page) {
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
    await writeFile(`${out}/failure.yml`, await page.locator("body").ariaSnapshot()).catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
  if (savedAvatar) {
    const current = await readProfile();
    if (current.avatar_url === savedAvatar) checked(await db.from("profiles").update({ avatar_url: original.avatar_url }).eq("id", ownerId).eq("avatar_url", savedAvatar));
  }
  const restored = await readProfile();
  result.cleanup = restored.avatar_url === original.avatar_url && fingerprint(restored) === fingerprint(original);
  await writeFile(`${out}/results.json`, `${JSON.stringify(result, null, 2)}\n`);
  console.log("CLEANUP", result.cleanup);
  assert.ok(result.cleanup, "profile must be restored without changing preferences");
}
