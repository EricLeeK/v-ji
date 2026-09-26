import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  "dev";

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  swSrc: "app/sw.ts",
  // Load the avatar library only when opened, including for installed PWAs.
  globIgnores: ["**/node_modules/**/*", "public/avatars/**"],
  useNativeEsbuild: true,
});
