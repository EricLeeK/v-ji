import { afterEach, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const PUBLISHABLE_KEY = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const previous = {
  url: process.env[URL_KEY],
  key: process.env[PUBLISHABLE_KEY],
};

afterEach(() => {
  restore(URL_KEY, previous.url);
  restore(PUBLISHABLE_KEY, previous.key);
});

it("returns JSON 503 for the agent API when the public Supabase env is missing", async () => {
  delete process.env[URL_KEY];
  delete process.env[PUBLISHABLE_KEY];
  const response = await updateSession(new NextRequest("https://v-ji.example/api/v1"));
  expect(response.status).toBe(503);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toEqual({
    error: { code: "unavailable", message: "服务端未配置 Supabase 连接，卡片接口暂时不可用" },
  });
});

it("returns plain 503 for pages when the public Supabase env is missing", async () => {
  delete process.env[URL_KEY];
  process.env[PUBLISHABLE_KEY] = "sb_publishable_present";
  const response = await updateSession(new NextRequest("https://v-ji.example/login"));
  expect(response.status).toBe(503);
  expect(await response.text()).toBe("服务端未配置 Supabase 连接");
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
