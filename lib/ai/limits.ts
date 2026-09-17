export const AI_LIMITS = {
  maxPdfPages: 60,
  maxImages: 30,
  maxTextTokens: 200_000,
  maxCards: 100,
  maxSourceFiles: 12,
  dailyTokensRegistered: 1_000_000,
  dailyTokensAnonymous: 100_000,
  sourceRetentionDays: 30,
} as const;

export function dailyTokenQuota(anonymous: boolean) {
  return anonymous ? AI_LIMITS.dailyTokensAnonymous : AI_LIMITS.dailyTokensRegistered;
}
