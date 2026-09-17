import { expect, test } from "@playwright/test";

test("demo user can create a card and rate it in a study session", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "使用演示账号" }).click();
  await page.waitForURL("**/today", { timeout: 25_000 });

  const name = `E2E ${Date.now()}`;
  await page.goto("/decks/new");
  await page.getByPlaceholder("例如：考研英语").fill(name);
  await page.getByRole("button", { name: "创建" }).click();
  await page.waitForURL(/\/decks\/[0-9a-f-]+$/);

  await page.getByRole("link", { name: /添加卡片/ }).click();
  await page.locator("textarea").first().fill("2+2 等于多少？");
  await page.locator("textarea").nth(1).fill("4");
  await page.getByRole("button", { name: "保存卡片" }).click();
  await page.waitForURL(/\/decks\/[0-9a-f-]+$/);

  await page.getByRole("link", { name: "学习", exact: true }).click();
  await page.waitForURL("**/study**");
  await page.getByRole("button", { name: "显示答案" }).click();
  await expect(page.getByText("4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "记得" }).click();
  await expect(page.getByText(/还剩 0|今日已完成|本轮已完成/)).toBeVisible();
});
