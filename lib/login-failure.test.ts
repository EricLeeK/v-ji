import { describe, expect, it } from "vitest";
import { getRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { LOGIN_NETWORK_ERROR, loginFailureMessage } from "./login-failure";

describe("loginFailureMessage", () => {
  it("does not treat a successful post-login redirect as a failure", () => {
    const redirectError = getRedirectError("/today", "push", 307);
    expect(isRedirectError(redirectError)).toBe(true);
    expect(loginFailureMessage(redirectError)).toBeNull();
  });

  it("ignores replace redirects used outside server actions", () => {
    const redirectError = getRedirectError("/today", "replace", 307);
    expect(isRedirectError(redirectError)).toBe(true);
    expect(loginFailureMessage(redirectError)).toBeNull();
  });

  it("still reports a real login failure", () => {
    expect(loginFailureMessage(new Error("network"))).toBe(LOGIN_NETWORK_ERROR);
    expect(loginFailureMessage({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" })).toBe(LOGIN_NETWORK_ERROR);
    expect(loginFailureMessage("failed")).toBe(LOGIN_NETWORK_ERROR);
  });
});
