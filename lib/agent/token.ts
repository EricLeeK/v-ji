import { createHash, randomBytes } from "node:crypto";

const TOKEN_PATTERN = /^vji_[A-Za-z0-9_-]{20,200}$/;

export function generateApiToken() {
  return `vji_${randomBytes(32).toString("base64url")}`;
}

export function hashApiToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function apiTokenPrefix(token: string) {
  return `${token.slice(0, 12)}…`;
}

export type Authorization =
  | { kind: "absent" }
  | { kind: "invalid" }
  | { kind: "bearer"; token: string };

export function classifyAuthorization(header: string | null): Authorization {
  if (!header?.trim()) return { kind: "absent" };
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header.trim());
  if (!match || !TOKEN_PATTERN.test(match[1])) return { kind: "invalid" };
  return { kind: "bearer", token: match[1] };
}

/**
 * Bearer token wins when present. An invalid or revoked token does not fall back to the browser session.
 * The owner always comes from the token record or the session, never from the request body.
 */
export async function resolveActor(
  authorization: string | null,
  sessionUserId: string | null,
  findOwnerByTokenHash: (tokenHash: string) => Promise<string | null>,
): Promise<{ userId: string; tokenHash: string | null } | null> {
  const parsed = classifyAuthorization(authorization);
  if (parsed.kind === "invalid") return null;
  if (parsed.kind === "bearer") {
    const tokenHash = hashApiToken(parsed.token);
    const userId = await findOwnerByTokenHash(tokenHash);
    if (!userId) return null;
    return { userId, tokenHash };
  }
  if (!sessionUserId) return null;
  return { userId: sessionUserId, tokenHash: null };
}
