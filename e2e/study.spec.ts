import { expect, test } from "./fixtures";

test("demo user can create a card and rate it in a study session", async ({ page, testDeck }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "使用演示账号" }).click();
  await page.waitForURL("**/today", { timeout: 25_000 });

  await page.goto("/decks/new");
  await page.getByPlaceholder("例如：考研英语").fill(testDeck.name);
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
  // Wait for the background save before fixture teardown deletes the test card.
  await expect(page.getByRole("heading", { name: "本轮已完成", exact: true })).toBeVisible();
});

test("study swipe surface keeps the viewport fixed during a horizontal gesture", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "使用演示账号" }).click();
  await page.waitForURL("**/today", { timeout: 25_000 });
  await page.goto("/study");
  await expect(page.getByRole("button", { name: "显示答案" })).toBeVisible();

  const touchState = await page.getByTestId("study-session").evaluate((root) => {
    const card = root.querySelector("div.cursor-pointer");
    if (!card) throw new Error("study swipe card not found");
    return {
      touchAction: getComputedStyle(card).touchAction,
      sessionOverflowY: getComputedStyle(root).overflowY,
      sessionOverscrollY: getComputedStyle(root).overscrollBehaviorY,
      documentOverscrollY: getComputedStyle(document.documentElement).overscrollBehaviorY,
      bodyOverscrollY: getComputedStyle(document.body).overscrollBehaviorY,
      bodyPosition: getComputedStyle(document.body).position,
      bodyOverflowY: getComputedStyle(document.body).overflowY,
    };
  });

  expect(touchState.touchAction).toBe("pan-y");
  expect(touchState.sessionOverflowY).toBe("hidden");
  expect(touchState.sessionOverscrollY).toBe("none");
  expect(touchState.documentOverscrollY).toBe("none");
  expect(touchState.bodyOverscrollY).toBe("none");
  expect(touchState.bodyPosition).toBe("fixed");
  expect(touchState.bodyOverflowY).toBe("hidden");

  await page.evaluate(() => window.scrollTo(0, 300));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await page.getByRole("button", { name: "结束学习", exact: true }).click();
  await page.getByRole("button", { name: "结束", exact: true }).click();
  await page.waitForURL("**/today");
  await expect(page.locator("body")).toHaveCSS("position", "static");
});
