import { describe, expect, it } from "vitest";
import { safeNextPath, siteOrigin } from "./site-url";

describe("siteOrigin", () => {
  it("prefers NEXT_PUBLIC_SITE_URL without trailing slash", () => {
    expect(
      siteOrigin({
        NEXT_PUBLIC_SITE_URL: "https://v-ji-six.vercel.app/",
        VERCEL_URL: "example.vercel.app",
      }),
    ).toBe("https://v-ji-six.vercel.app");
  });

  it("uses Vercel production host when site URL is missing", () => {
    expect(
      siteOrigin({
        VERCEL_PROJECT_PRODUCTION_URL: "v-ji-six.vercel.app",
      }),
    ).toBe("https://v-ji-six.vercel.app");
  });

  it("falls back to localhost", () => {
    expect(siteOrigin({})).toBe("http://localhost:3000");
  });
});

describe("safeNextPath", () => {
  it("keeps local paths", () => {
    expect(safeNextPath("/decks/123?tab=cards")).toBe("/decks/123?tab=cards");
  });

  it("rejects external and protocol-relative redirects", () => {
    expect(safeNextPath("https://evil.example/login")).toBe("/today");
    expect(safeNextPath("//evil.example/login")).toBe("/today");
  });
});
