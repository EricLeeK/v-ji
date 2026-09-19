import { describe, expect, it } from "vitest";
import { protectCardImageUrl } from "@/lib/card-image-url";

describe("protectCardImageUrl", () => {
  it("routes legacy public card-image URLs through the authenticated endpoint", () => {
    expect(
      protectCardImageUrl(
        "https://project.supabase.co/storage/v1/object/public/card-images/user/file%20one.png",
      ),
    ).toBe("/api/card-images?path=user%2Ffile%20one.png");
  });

  it("leaves non-card URLs unchanged", () => {
    expect(protectCardImageUrl("https://example.com/image.png")).toBe("https://example.com/image.png");
  });
});
