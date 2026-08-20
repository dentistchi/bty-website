"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, supabase as supabaseMaybe } from "@/lib/supabase";
import { isNative } from "@/lib/native/isNative";
import { storeNativeSession } from "@/lib/native/durableSession";

export type LoginCardLocale = "en" | "ko";

/** Page-level auth UI states (see UX doc). */
export type LoginAuthPhase =
  | "initial"
  | "oauth_redirecting"
  | "phone_editing"
  | "otp_sending"
  | "otp_sent"
  | "otp_verifying"
  | "error";

type LoginCardProps = {
  locale: LoginCardLocale;
  /** Post-auth redirect path (must be same-origin relative, starting with /). */
  nextPath: string;
  /** Optional OAuth/callback error surfaced via query string. */
  initialError?: string;
  /**
   * Account-switch entry (`?switch=1`): force the native Google account chooser so a
   * deliberate switch cannot silently re-select the previous account. Default false →
   * normal login is behaviorally unchanged.
   */
  forceAccountSelection?: boolean;
};

const C = {
  ko: {
    headline: "bty에 오신 것을 환영합니다",
    sub:
      "치과 리더십·훈련을 위한 공간입니다. 아래 방법 중 하나로 계속하시면, 처음 오신 분은 자동으로 시작할 수 있어요.",
    accountHint:
      "처음 연결하시는 경우에도 같은 화면에서 바로 시작됩니다. 별도 가입 절차는 없습니다.",
    continueGoogle: "Google로 계속하기",
    continueMicrosoft: "Microsoft로 계속하기",
    continuePhone: "휴대폰 번호로 계속하기",
    phoneSectionTitle: "휴대폰으로 로그인",
    phoneLabel: "휴대폰 번호",
    phonePlaceholder: "국가번호 포함 (예: +82…)",
    phoneHelp: "국제 형식(E.164)으로 입력해 주세요.",
    sendCode: "인증 코드 보내기",
    sendingCode: "보내는 중…",
    codeLabel: "인증 코드",
    codePlaceholder: "6자리 코드",
    verify: "확인하고 계속하기",
    verifying: "확인 중…",
    resend: "코드 다시 보내기",
    changeNumber: "번호 변경",
    oauthWait: "연결 중… 잠시만 기다려 주세요.",
    otpSent:
      "코드를 보냈습니다. 문자를 확인한 뒤 아래에 입력해 주세요. 오지 않으면 스팸함도 확인해 보세요.",
    errorGeneric: "문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    errorSupabase: "로그인 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.",
    errorInvalidPhone: "휴대폰 번호 형식을 확인해 주세요.",
    errorInvalidCode: "코드를 확인해 주세요.",
    retryCta: "다시 시도",
    cookieNote: "세션은 안전한 쿠키로 유지됩니다. 로그인 후 이동할 수 있습니다.",
  },
  en: {
    headline: "Welcome to bty",
    sub:
      "A calm space for dental leadership and practice training. Pick an option below—if you’re new here, you can get started in the same step.",
    accountHint:
      "First time connecting? You can start here—no separate signup screen.",
    continueGoogle: "Continue with Google",
    continueMicrosoft: "Continue with Microsoft",
    continuePhone: "Continue with Phone",
    phoneSectionTitle: "Sign in with phone",
    phoneLabel: "Phone number",
    phonePlaceholder: "Include country code (e.g. +1…)",
    phoneHelp: "Use international format (E.164).",
    sendCode: "Send verification code",
    sendingCode: "Sending…",
    codeLabel: "Verification code",
    codePlaceholder: "6-digit code",
    verify: "Verify and continue",
    verifying: "Verifying…",
    resend: "Resend code",
    changeNumber: "Change number",
    oauthWait: "Connecting… Please wait.",
    otpSent:
      "We sent a code. Enter it below. If you don’t see it, check your spam folder.",
    errorGeneric: "Something went wrong. Please retry.",
    errorSupabase: "Sign-in isn’t configured yet. Please contact your administrator.",
    errorInvalidPhone: "Check your phone number format.",
    errorInvalidCode: "Check your verification code.",
    retryCta: "Retry",
    cookieNote: "Your session is kept with secure cookies. You may be redirected after sign-in.",
  },
} as const;

function safeOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

/** Lowercase hex of a byte array (SHA-256 nonce digest; NOT base64). */
const hexFromBytes = (b: Uint8Array) =>
  Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");

/**
 * Supabase redirects here after IdP → `auth/v1/callback` with `?code=` or implicit hash tokens.
 * Use the locale **page** (`/[locale]/auth/callback`) so the browser client can exchange the code / read hashes
 * (PKCE + Microsoft/Azure edge cases). The `/api/auth/callback` route is server-only and only sees query params.
 */
function buildOAuthRedirectTo(locale: LoginCardLocale, nextPath: string): string {
  const next = encodeURIComponent(nextPath);
  const origin = safeOrigin();
  return `${origin}/${locale}/auth/callback?next=${next}`;
}

/**
 * Native Google Sign-In plugin (@capgo/capacitor-social-login) injected into the
 * hosted WebView by the native shell. Typed locally so the inner web bundle keeps
 * NO `@capacitor/*` import (same rule as isNative.ts's bridge shim).
 */
type SocialLoginPlugin = {
  initialize: (options: {
    google: { iOSClientId: string; mode: "online" | "offline" };
  }) => Promise<void>;
  login: (options: {
    provider: "google";
    options: {
      scopes?: string[];
      nonce?: string;
      forcePrompt?: boolean;
      /** iOS: force the account selection prompt (used on a deliberate account switch). */
      forceAccountSelection?: boolean;
    };
  }) => Promise<{
    result: { idToken: string | null };
  }>;
};

/** Logs full provider message; UI shows short copy only (release safety). */
function userFacingOauthOrOtpError(raw: string | undefined, t: { errorGeneric: string }): string {
  const msg = (raw ?? "").trim() || t.errorGeneric;
  console.warn("[login-card] auth error detail (not shown verbatim in UI)", msg.slice(0, 800));
  return t.errorGeneric;
}

/** Loose E.164: leading + and 8–15 digits after. */
function looksLikeE164(phone: string): boolean {
  const t = phone.trim();
  if (!t.startsWith("+")) return false;
  const digits = t.slice(1).replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Public auth providers — Commander launch lock (D-1, 2026-05-29): default to
 * Google only. Microsoft (azure) + Phone OTP code paths below are retained
 * intact but hidden unless explicitly enabled via NEXT_PUBLIC_BTY_AUTH_PROVIDERS
 * (comma list, e.g. "google,microsoft,phone"). Read per-render so the flag is
 * pickup-able in tests; Next inlines the NEXT_PUBLIC_* literal at build time.
 */
function enabledProviders(): { google: boolean; microsoft: boolean; phone: boolean } {
  const list = (process.env.NEXT_PUBLIC_BTY_AUTH_PROVIDERS || "google")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return {
    google: list.includes("google"),
    microsoft: list.includes("microsoft"),
    phone: list.includes("phone"),
  };
}

export default function LoginCard({ locale, nextPath, initialError, forceAccountSelection }: LoginCardProps) {
  const { google: showGoogle, microsoft: showMicrosoft, phone: showPhone } = enabledProviders();
  const t = C[locale];
  const [phase, setPhase] = useState<LoginAuthPhase>("initial");
  const [oauthProvider, setOauthProvider] = useState<"google" | "azure" | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [phoneExpanded, setPhoneExpanded] = useState(false);
  /** After first successful OTP request, keep code inputs visible through errors/retries. */
  const [hasSentCode, setHasSentCode] = useState(false);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  const configured = Boolean(supabaseMaybe);

  const clearErrorAndRetry = useCallback(() => {
    setPhase(hasSentCode ? "otp_sent" : "initial");
    setOauthProvider(null);
    setError(null);
  }, [hasSentCode]);

  const onOAuth = useCallback(
    async (provider: "google" | "azure") => {
      setError(null);
      if (!configured) {
        setPhase("error");
        setError(t.errorSupabase);
        return;
      }
      setPhase("oauth_redirecting");
      setOauthProvider(provider);
      try {
        const supabase = getSupabase();
        // Native path (Google only): native Google Sign-In → idToken →
        // signInWithIdToken → reuse the existing POST /api/auth/session. No system
        // browser, no btyarena:// round-trip, no PKCE verifier / stash / bridge / latch.
        if (isNative() && provider === "google") {
          const social = (
            window.Capacitor?.Plugins as
              | { SocialLogin?: SocialLoginPlugin }
              | undefined
          )?.SocialLogin;
          if (!social) {
            setPhase("error");
            setError(userFacingOauthOrOtpError("native-google-unavailable", t));
            setOauthProvider(null);
            return;
          }
          await social.initialize({
            google: {
              iOSClientId:
                "1012329580428-fp0r4m3kt06jtojog2f8qmtnvluhkmoe.apps.googleusercontent.com",
              mode: "online",
            },
          });
          // Nonce symmetry: generate rawNonce ONCE, send its SHA-256 hex DIGEST to
          // Google (embedded as id_token.nonce), and the RAW value to Supabase, which
          // re-hashes and compares. getRandomValues (NOT randomUUID — needs iOS 15.4;
          // target is 15.0). forcePrompt forces a fresh sign-in so OUR nonce is used
          // (not a cached/restored token that would ignore it).
          const rawNonce = hexFromBytes(crypto.getRandomValues(new Uint8Array(32)));
          const digestBuf = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(rawNonce)
          );
          const nonceDigest = hexFromBytes(new Uint8Array(digestBuf));
          const res = await social.login({
            provider: "google",
            options: {
              nonce: nonceDigest,
              forcePrompt: true,
              // Deliberate account switch (?switch=1): force the iOS chooser so the previous
              // account cannot be silently re-selected. Absent on a normal login (unchanged).
              ...(forceAccountSelection ? { forceAccountSelection: true } : {}),
            },
          });
          const idToken = res.result.idToken;
          if (!idToken) {
            setPhase("error");
            setError(userFacingOauthOrOtpError("native-google-no-idtoken", t));
            setOauthProvider(null);
            return;
          }
          const { data: idData, error: idError } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: idToken,
            nonce: rawNonce,
          });
          if (idError || !idData.session) {
            setPhase("error");
            setError(userFacingOauthOrOtpError(idError?.message, t));
            setOauthProvider(null);
            return;
          }
          // Reuse the server-session POST (mirrors the callback page's postServerSession):
          // the WebView JS-store session is invisible to the server gate, so POST the
          // tokens → server Set-Cookies the httpOnly session into WKHTTPCookieStore
          // before /start's gate fires.
          await fetch("/api/auth/session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              access_token: idData.session.access_token,
              refresh_token: idData.session.refresh_token,
            }),
          });
          // STEP A2 — persist durable session to the iOS Keychain BEFORE leaving
          // login, so a hard-kill immediately after login (before WKWebView flushes
          // its cookie to disk) can restore on relaunch without Google. Awaited.
          await storeNativeSession({
            access_token: idData.session.access_token,
            refresh_token: idData.session.refresh_token,
            expires_at: idData.session.expires_at ?? null,
          });
          window.location.assign(nextPath);
          return;
        }
        const redirectTo = buildOAuthRedirectTo(locale, nextPath);
        const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            // Native: keep the WebView put and open the authorize URL in the
            // system browser below. Web: false (unchanged) → in-page redirect.
            skipBrowserRedirect: isNative(),
            /*
              THE CHOOSER IS FOR SWITCHING, NOT FOR SIGNING IN (Slice R4-R4B-R2).

              This was unconditional. Its own note explains the reason as a LOGOUT concern — "an
              active Google SSO session re-authenticates silently right after logout" — and then
              applied it to every sign-in, so every returning user got a full interactive account
              chooser and another "You shared some Google Account data with BTY" email.

              `forceAccountSelection` already exists on this component, is already set from
              `?switch=1`, and the NATIVE branch a few lines up already honours it. Only the web
              branch ignored the prop it was handed. Scopes are untouched.
            */
            ...(forceAccountSelection ? { queryParams: { prompt: "select_account" } } : {}),
          },
        });
        if (oauthError) {
          setPhase("error");
          setError(userFacingOauthOrOtpError(oauthError.message, t));
          setOauthProvider(null);
          return;
        }
      } catch (e) {
        setPhase("error");
        setError(userFacingOauthOrOtpError(e instanceof Error ? e.message : undefined, t));
        setOauthProvider(null);
      }
    },
    [configured, locale, nextPath, forceAccountSelection, t.errorGeneric, t.errorSupabase]
  );

  const onSendOtp = useCallback(async () => {
    setError(null);
    if (!configured) {
      setPhase("error");
      setError(t.errorSupabase);
      return;
    }
    const trimmed = phone.trim();
    if (!looksLikeE164(trimmed)) {
      setPhase("error");
      setError(t.errorInvalidPhone);
      return;
    }
    setPhase("otp_sending");
    try {
      const supabase = getSupabase();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: trimmed,
        options: {
          shouldCreateUser: true,
        },
      });
      if (otpError) {
        setPhase("error");
        setError(userFacingOauthOrOtpError(otpError.message, t));
        return;
      }
      setHasSentCode(true);
      setPhase("otp_sent");
    } catch (e) {
      setPhase("error");
      setError(userFacingOauthOrOtpError(e instanceof Error ? e.message : undefined, t));
    }
  }, [configured, phone, t.errorGeneric, t.errorInvalidPhone, t.errorSupabase]);

  const onVerifyOtp = useCallback(async () => {
    setError(null);
    if (!configured) {
      setPhase("error");
      setError(t.errorSupabase);
      return;
    }
    const trimmedPhone = phone.trim();
    const code = otp.trim();
    if (!looksLikeE164(trimmedPhone) || code.length < 4) {
      setPhase("error");
      setError(t.errorInvalidCode);
      return;
    }
    setPhase("otp_verifying");
    try {
      const supabase = getSupabase();
      const { data, error: vError } = await supabase.auth.verifyOtp({
        phone: trimmedPhone,
        token: code,
        type: "sms",
      });
      if (vError || !data.session) {
        setPhase("error");
        setError(userFacingOauthOrOtpError(vError?.message, t));
        setHasSentCode(true);
        return;
      }
      window.location.assign(nextPath);
    } catch (e) {
      setPhase("error");
      setHasSentCode(true);
      setError(userFacingOauthOrOtpError(e instanceof Error ? e.message : undefined, t));
    }
  }, [configured, nextPath, otp, phone, t.errorGeneric, t.errorInvalidCode, t.errorSupabase]);

  const showPhonePanel =
    phoneExpanded ||
    hasSentCode ||
    phase === "otp_sending" ||
    phase === "otp_sent" ||
    phase === "otp_verifying";

  const oauthBusy = phase === "oauth_redirecting";
  const primaryDisabled = oauthBusy || phase === "otp_sending" || phase === "otp_verifying";

  return (
    <div
      className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/80 px-6 py-8 shadow-xl backdrop-blur-md sm:px-8"
      data-testid="login-card"
    >
      <header className="mb-6 text-center sm:text-left">
        {/* Phase 1 brand: gold knot glyph (gold-on-navy master) above the headline. Additive, decorative — headline text carries the accessible brand name. */}
        <img
          src="/brand/bty-knot-transparent-gold.svg"
          alt=""
          aria-hidden="true"
          width={56}
          height={56}
          className="mb-4 inline-block h-14 w-14 rounded-2xl"
        />
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{t.headline}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{t.sub}</p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">{t.accountHint}</p>
      </header>

      <div className="flex flex-col gap-3">
        {showGoogle && (
          <button
            type="button"
            disabled={primaryDisabled}
            onClick={() => onOAuth("google")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            aria-busy={oauthBusy && oauthProvider === "google"}
          >
            <span className="font-semibold">{t.continueGoogle}</span>
          </button>
        )}

        {showMicrosoft && (
          <button
            type="button"
            disabled={primaryDisabled}
            onClick={() => onOAuth("azure")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            aria-busy={oauthBusy && oauthProvider === "azure"}
          >
            <span>{t.continueMicrosoft}</span>
          </button>
        )}

        {showPhone && !showPhonePanel ? (
          <button
            type="button"
            disabled={primaryDisabled}
            onClick={() => {
              setPhoneExpanded(true);
              setPhase("phone_editing");
              setError(null);
            }}
            className="flex w-full items-center justify-center rounded-2xl border border-[color:var(--arena-accent)]/35 bg-slate-900/60 px-4 py-3 text-sm font-medium text-[color:var(--arena-accent)] transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t.continuePhone}
          </button>
        ) : null}
      </div>

      {oauthBusy ? (
        <p className="mt-4 text-center text-xs text-slate-400" role="status">
          {t.oauthWait}
        </p>
      ) : null}

      {showPhone && showPhonePanel ? (
        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900/40 p-4" aria-labelledby="phone-login-title">
          <h2 id="phone-login-title" className="text-sm font-medium text-slate-200">
            {t.phoneSectionTitle}
          </h2>
          <label className="mt-3 block text-xs font-medium text-slate-400" htmlFor="login-phone">
            {t.phoneLabel}
          </label>
          <input
            id="login-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t.phonePlaceholder}
            value={phone}
            disabled={hasSentCode && phase !== "phone_editing"}
            onChange={(e) => {
              setPhone(e.target.value);
              if (phase === "error") setPhase(hasSentCode ? "otp_sent" : "phone_editing");
            }}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-[color:var(--arena-accent)]/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--arena-accent)]/25 disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-slate-500">{t.phoneHelp}</p>

          {hasSentCode ? (
            <>
              <label className="mt-4 block text-xs font-medium text-slate-400" htmlFor="login-otp">
                {t.codeLabel}
              </label>
              <input
                id="login-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t.codePlaceholder}
                value={otp}
                disabled={phase === "otp_verifying"}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm tracking-widest text-white placeholder:text-slate-600 focus:border-[color:var(--arena-accent)]/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--arena-accent)]/25 disabled:opacity-60"
              />
            </>
          ) : null}

          {hasSentCode ? <p className="mt-3 text-xs leading-relaxed text-slate-400">{t.otpSent}</p> : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {hasSentCode ? (
              <>
                <button
                  type="button"
                  disabled={phase === "otp_verifying"}
                  onClick={onVerifyOtp}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-[color:var(--arena-accent)] px-4 py-2.5 text-sm font-medium text-slate-950 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {phase === "otp_verifying" ? t.verifying : t.verify}
                </button>
                <button
                  type="button"
                  disabled={phase === "otp_verifying"}
                  onClick={onSendOtp}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t.resend}
                </button>
                <button
                  type="button"
                  disabled={phase === "otp_verifying"}
                  onClick={() => {
                    setHasSentCode(false);
                    setOtp("");
                    setPhase("phone_editing");
                    setError(null);
                  }}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-transparent px-4 py-2.5 text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
                >
                  {t.changeNumber}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={phase === "otp_sending"}
                onClick={onSendOtp}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[color:var(--arena-accent)] px-4 py-2.5 text-sm font-medium text-slate-950 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {phase === "otp_sending" ? t.sendingCode : t.sendCode}
              </button>
            )}
          </div>
        </section>
      ) : null}

      {error ? (
        <div
          className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
          role="alert"
        >
          <p>{error}</p>
          {phase === "error" ? (
            <button
              type="button"
              onClick={clearErrorAndRetry}
              className="mt-2 text-xs font-medium text-[color:var(--arena-accent)] underline-offset-4 hover:underline"
            >
              {t.retryCta}
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-500 sm:text-left">{t.cookieNote}</p>
    </div>
  );
}
