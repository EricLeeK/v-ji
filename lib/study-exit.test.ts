import { describe, expect, it } from "vitest";
import { getRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { LEAVE_STUDY_ERROR, leaveStudyFailureMessage } from "./study-exit";

describe("leaveStudyFailureMessage", () => {
  it("does not treat the server-action exit redirect as a network failure", () => {
    const redirectError = getRedirectError("/today", "push", 307);
    expect(isRedirectError(redirectError)).toBe(true);
    expect(leaveStudyFailureMessage(redirectError)).toBeNull();
  });

  it("still reports a real failure to leave", () => {
    expect(leaveStudyFailureMessage(new Error("network"))).toBe(LEAVE_STUDY_ERROR);
    expect(leaveStudyFailureMessage({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" })).toBe(LEAVE_STUDY_ERROR);
  });
});