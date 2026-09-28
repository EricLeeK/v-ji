const NETWORK_ERROR = "收藏失败，请检查网络后重试";
const FALLBACK_ERROR = "收藏失败，请重试";

/**
 * Study starring is a plain POST, not a Server Action.
 * `toggleStar` calls `revalidatePath`, and Next.js then re-renders the current
 * `/study` route inside that action response. The browser aborts the large
 * flight payload (`Failed to fetch`) and the optimistic star rolls back.
 */
export async function requestStudyStar(
  cardId: string,
  starred: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<{ error?: string }> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/cards/${encodeURIComponent(cardId)}/star`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ starred }),
    });
  } catch {
    return { error: NETWORK_ERROR };
  }

  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (!response.ok || typeof body?.error === "string") {
    return { error: typeof body?.error === "string" && body.error ? body.error : FALLBACK_ERROR };
  }
  return {};
}
