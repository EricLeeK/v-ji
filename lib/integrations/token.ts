import { createHash, randomBytes } from "node:crypto";

export function createLearningHubToken() {
  return `vji_live_${randomBytes(32).toString("base64url")}`;
}

export function hashLearningHubToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
