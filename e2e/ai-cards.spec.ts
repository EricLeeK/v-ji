import { expect, test } from "@playwright/test";

test("ai generation refuses to start without a DeepSeek key", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "使用演示账号" }).click();
  await page.waitForURL("**/today", { timeout: 25_000 });

  await page.goto("/me/settings");
  const clear = page.getByTestId("deepseek-key-clear");
  if (await clear.isVisible()) await clear.click();
  await expect(page.getByTestId("deepseek-key-status")).toHaveText("尚未配置");

  await page.goto("/ai/new");
  await expect(page.getByTestId("ai-missing-key")).toContainText("尚未配置 DeepSeek API Key");
  await page.getByTestId("ai-generate").click();
  await expect(page).toHaveURL(/\/ai\/new/);
  await page.getByRole("link", { name: "去设置" }).click();
  await expect(page).toHaveURL(/\/me\/settings/);
  await expect(page.getByTestId("deepseek-key-status")).toHaveText("尚未配置");
});

test("settings can save and mask a user DeepSeek key", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "使用演示账号" }).click();
  await page.waitForURL("**/today", { timeout: 25_000 });

  await page.goto("/me/settings");
  const clear = page.getByTestId("deepseek-key-clear");
  if (await clear.isVisible()) await clear.click();

  await page.getByTestId("deepseek-key-input").fill("sk-abcdefghijklmnopqrstuvwxyz");
  await page.getByTestId("deepseek-key-save").click();
  await expect(page.getByTestId("deepseek-key-status")).toContainText("已配置 sk-••••wxyz");

  await page.goto("/ai/new");
  await expect(page.getByTestId("ai-missing-key")).toHaveCount(0);

  await page.goto("/me/settings");
  await page.getByTestId("deepseek-key-clear").click();
  await expect(page.getByTestId("deepseek-key-status")).toHaveText("尚未配置");
});
