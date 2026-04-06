/**
 * OAuth/callback query `error` values — short codes only (no raw provider strings in URLs).
 */
export type OAuthCallbackErrorCode = "missing_code" | "oauth_session_failed";

export function userMessageForOAuthCallbackError(
  code: string | undefined,
  locale: "en" | "ko",
): string | undefined {
  if (!code?.trim()) return undefined;
  const c = code.trim();
  if (c === "missing_code") {
    return locale === "ko" ? "인증 정보가 없습니다. 다시 시도해 주세요." : "Missing sign-in code. Please retry.";
  }
  if (c === "oauth_session_failed") {
    return locale === "ko"
      ? "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요."
      : "Sign-in failed. Please retry.";
  }
  if (process.env.NODE_ENV === "development") {
    console.warn("[oauth-callback] unmapped error code (showing generic)", c.slice(0, 120));
  }
  return locale === "ko" ? "문제가 발생했습니다. 잠시 후 다시 시도해 주세요." : "Something went wrong. Please retry.";
}
