import { isNextRedirectError } from "@/lib/navigation-error";

export const LOGIN_NETWORK_ERROR = "暂时无法登录，请检查网络后重试";

/**
 * A successful Server Action calls `redirect()`, and Next rejects the client
 * promise with a NEXT_REDIRECT digest after navigation has already started.
 * That rejection is not a failed login.
 */
export function loginFailureMessage(error: unknown): string | null {
  if (isNextRedirectError(error)) return null;
  return LOGIN_NETWORK_ERROR;
}
