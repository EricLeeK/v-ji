import { expect, it, vi } from "vitest";
import { requestStudyStar } from "@/lib/study-star";

const cardId = "5718b0dd-fba3-444e-bfdb-b2e6b9d2bcc1";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

it("posts the starred flag and treats an empty success body as saved", async () => {
  const fetchImpl = vi.fn(async () => jsonResponse({}));
  expect(await requestStudyStar(cardId, true, fetchImpl)).toEqual({});
  expect(fetchImpl).toHaveBeenCalledWith(`/api/cards/${cardId}/star`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ starred: true }),
  });
});

it("sends starred false when the card is unstarred", async () => {
  const fetchImpl = vi.fn(async () => jsonResponse({}));
  expect(await requestStudyStar(cardId, false, fetchImpl)).toEqual({});
  expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({ starred: false });
});

it("passes through the server error message", async () => {
  const fetchImpl = vi.fn(async () => jsonResponse({ error: "卡片不存在或已被删除" }, 404));
  expect(await requestStudyStar(cardId, true, fetchImpl)).toEqual({ error: "卡片不存在或已被删除" });
});

it("never surfaces the browser Failed to fetch message", async () => {
  const fetchImpl = vi.fn(async () => {
    throw new TypeError("Failed to fetch");
  });
  expect(await requestStudyStar(cardId, true, fetchImpl)).toEqual({ error: "收藏失败，请检查网络后重试" });
});

it("uses a fallback when the error response is not JSON", async () => {
  const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
  expect(await requestStudyStar(cardId, true, fetchImpl)).toEqual({ error: "收藏失败，请重试" });
});
