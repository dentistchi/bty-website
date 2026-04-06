"use client";

import { useMemo } from "react";
import LoginCard from "@/components/auth/login-card";
import { userMessageForOAuthCallbackError } from "@/lib/auth/oauth-callback-error-messages";
import { sanitizeNextForRedirect } from "@/lib/auth/sanitize-next-for-redirect";

function decodeError(raw: string | undefined): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function LoginClient({
  nextPath,
  locale,
  oauthError,
}: {
  nextPath: string;
  locale: "en" | "ko";
  oauthError?: string;
}) {
  const next = useMemo(() => sanitizeNextForRedirect(nextPath, { locale }), [nextPath, locale]);
  const initialError = useMemo(() => {
    const decoded = decodeError(oauthError);
    if (!decoded) return undefined;
    return userMessageForOAuthCallbackError(decoded, locale);
  }, [oauthError, locale]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-12 sm:px-6"
      data-testid="login-page"
    >
      <LoginCard locale={locale} nextPath={next} initialError={initialError} />
    </div>
  );
}
