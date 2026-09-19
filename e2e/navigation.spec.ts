import { expect, test } from "@playwright/test";

// Prefetching is production-only. Set PLAYWRIGHT_BASE_URL to a running `next start`.
test.skip(!process.env.PLAYWRIGHT_BASE_URL, "Requires a production build to enable route prefetching.");

test("tab links request complete dynamic routes before they are tapped", async ({ page }) => {
  const prefetched = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    const headers = request.headers();
    if (
      url.searchParams.has("_rsc") &&
      headers["next-router-state-tree"] &&
      !headers["next-router-segment-prefetch"]
    ) {
      prefetched.add(url.pathname);
    }
  });

  await page.goto("/login");
  await page.getByRole("button", { name: "使用演示账号" }).click();
  await page.waitForURL("**/today", { timeout: 25_000 });

  await expect
    .poll(
      () => [...prefetched].filter((path) => ["/decks", "/library", "/me"].includes(path)),
      { timeout: 15_000 },
    )
    .toEqual(expect.arrayContaining(["/decks", "/library", "/me"]));
});
