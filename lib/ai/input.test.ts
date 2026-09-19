import { describe, expect, it } from "vitest";
import { validateAiSourceInput } from "@/lib/ai/input";

const uid = "11111111-1111-4111-8111-111111111111";

describe("validateAiSourceInput", () => {
  it("rejects a storage path outside the current user namespace", () => {
    expect(
      validateAiSourceInput(
        { kind: "pdf", name: "notes.pdf", storagePath: "22222222-2222-4222-8222-222222222222/secret.pdf" },
        uid,
      ),
    ).toBe("资料存储路径无效");
  });

  it("rejects traversal and missing file paths", () => {
    expect(validateAiSourceInput({ kind: "image", name: "x.png", storagePath: `${uid}/../secret.png` }, uid)).toBe(
      "资料存储路径无效",
    );
    expect(validateAiSourceInput({ kind: "pdf", name: "x.pdf" }, uid)).toBe("资料文件未上传");
  });

  it("accepts bounded text sources", () => {
    expect(validateAiSourceInput({ kind: "text", name: "摘录", text: "核心概念" }, uid)).toBeNull();
  });
});
