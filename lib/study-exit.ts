import { isNextRedirectError } from "@/lib/navigation-error";

export const LEAVE_STUDY_ERROR = "暂时无法离开，请检查网络后重试";

/** Leaving study redirects on success. That redirect is not a network failure. */
export function leaveStudyFailureMessage(error: unknown): string | null {
  if (isNextRedirectError(error)) return null;
  return LEAVE_STUDY_ERROR;
}