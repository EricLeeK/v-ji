export const LOGIN_NETWORK_ERROR = "暂时无法登录，请检查网络后重试";

const REDIRECT_STATUS = new Set([303, 307, 308]);

/**
 * A successful Server Action calls `redirect()`, and Next rejects the client
 * promise with a NEXT_REDIRECT digest after navigation has already started.
 * That rejection is not a failed login. See next/dist/client/components/redirect-error.js.
 */
export function loginFailureMessage(error: unknown): string | null {
  if (isNextRedirectError(error)) return null;
  return LOGIN_NETWORK_ERROR;
}

function isNextRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  const digest = (error as { digest: unknown }).digest;
  if (typeof digest !== "string") return false;
  const parts = digest.split(";");
  const [code, type] = parts;
  const destination = parts.slice(2, -2).join(";");
  const status = Number(parts.at(-2));
  return code === "NEXT_REDIRECT"
    && (type === "push" || type === "replace")
    && destination.length > 0
    && REDIRECT_STATUS.has(status);
}
