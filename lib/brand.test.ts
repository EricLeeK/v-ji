import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_MARK, PRODUCT_NAME } from "./brand";

describe("product branding", () => {
  it("uses the V 记 display name and mark", () => {
    expect(PRODUCT_NAME).toBe("V 记");
    expect(PRODUCT_MARK).toBe("V");
  });

  it("keeps install metadata aligned with the display name", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "public/manifest.webmanifest"), "utf8"),
    ) as { name: string; short_name: string };

    expect(manifest.name).toBe(PRODUCT_NAME);
    expect(manifest.short_name).toBe(PRODUCT_NAME);
  });
});
