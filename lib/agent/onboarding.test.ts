import { expect, it } from "vitest";
import * as onboarding from "./onboarding";
it("builds a copyable connection with the actual token and a prompt containing no secret", () => {
  expect(typeof onboarding.connectionConfig).toBe("function");
  const token = "vji_private_connection_test";
  const config = JSON.parse(
    onboarding.connectionConfig("https://example.com/", token),
  );
  expect(config.mcpServers["v-ji"].url).toBe("https://example.com/api/mcp");
  expect(config.mcpServers["v-ji"].headers.Authorization).toBe(
    "Bearer " + token,
  );
  const prompt = onboarding.firstCardPrompt({
    id: "11111111-1111-4111-8111-111111111111",
    name: "英语",
  });
  expect(prompt).toContain("list_decks");
  expect(prompt).toContain("11111111-1111-4111-8111-111111111111");
  expect(prompt).not.toContain(token);
});
it("does not mark a protocol response or invalid token as a verified connection", async () => {
  expect(typeof onboarding.probeConnection).toBe("function");
  const good = async () =>
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: {
          isError: false,
          content: [
            {
              type: "text",
              text: JSON.stringify({ decks: [], nextOffset: null }),
            },
          ],
        },
      }),
    );
  expect(
    await onboarding.probeConnection("vji_test", good as typeof fetch),
  ).toEqual({ decks: 0 });
  for (const response of [
    new Response("{}", { status: 401 }),
    new Response(JSON.stringify({ error: { message: "bad" } })),
    new Response(JSON.stringify({ result: { isError: true, content: [] } })),
  ]) {
    await expect(
      onboarding.probeConnection(
        "vji_test",
        (async () => response) as typeof fetch,
      ),
    ).rejects.toThrow();
  }
});
