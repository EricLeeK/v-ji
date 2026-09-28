import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toggleStar: vi.fn<(cardId: string, starred: boolean) => Promise<{ error?: string }>>(async () => ({})),
}));
vi.mock("@/app/actions/notes", () => ({ toggleStar: mocks.toggleStar }));

import { POST } from "@/app/api/cards/[id]/star/route";

const cardId = "5718b0dd-fba3-444e-bfdb-b2e6b9d2bcc1";

function call(body: unknown, id = cardId) {
  return POST(
    new Request(`http://localhost/api/cards/${id}/star`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.toggleStar.mockResolvedValue({});
});

it("stars and unstars through the existing toggleStar action", async () => {
  const starred = await call({ starred: true });
  expect(starred.status).toBe(200);
  expect(await starred.json()).toEqual({});

  const unstarred = await call({ starred: false });
  expect(unstarred.status).toBe(200);
  expect(mocks.toggleStar.mock.calls).toEqual([[cardId, true], [cardId, false]]);
});

it("maps login and missing-card errors", async () => {
  mocks.toggleStar.mockResolvedValueOnce({ error: "请先登录" });
  expect((await call({ starred: true })).status).toBe(401);

  mocks.toggleStar.mockResolvedValueOnce({ error: "卡片不存在或已被删除" });
  const missing = await call({ starred: false });
  expect(missing.status).toBe(404);
  expect(await missing.json()).toEqual({ error: "卡片不存在或已被删除" });
});

it("returns 500 when starring fails for an unknown server error", async () => {
  mocks.toggleStar.mockResolvedValueOnce({ error: "connection reset" });
  const response = await call({ starred: true });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "connection reset" });
});

it("rejects a bad id or body without touching the database", async () => {
  expect((await call({ starred: true }, "not-a-card")).status).toBe(404);
  expect((await call({ starred: "yes" })).status).toBe(400);
  expect((await call("{")).status).toBe(400);
  expect(mocks.toggleStar).not.toHaveBeenCalled();
});
