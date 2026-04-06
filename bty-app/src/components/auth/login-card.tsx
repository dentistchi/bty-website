"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, supabase as supabaseMaybe } from "@/lib/supabase";

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
};

const C = {
  ko: {
    headline: "BTY에 오신 것을 환영합니다",
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
    headline: "Welcome to BTY",
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

function buildOAuthRedirectTo(nextPath: string): string {
  const origin = safeOrigin();
  const next = encodeURIComponent(nextPath);
  return `${origin}/api/auth/callback?next=${next}`;
}

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

export default function LoginCard({ locale, nextPath, initialError }: LoginCardProps) {
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
        const redirectTo = buildOAuthRedirectTo(nextPath);
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            skipBrowserRedirect: false,
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
    [configured, nextPath, t.errorGeneric, t.errorSupabase]
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
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{t.headline}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{t.sub}</p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">{t.accountHint}</p>
      </header>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={primaryDisabled}
          onClick={() => onOAuth("google")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          aria-busy={oauthBusy && oauthProvider === "google"}
        >
          <span className="font-semibold">{t.continueGoogle}</span>
        </button>

        <button
          type="button"
          disabled={primaryDisabled}
          onClick={() => onOAuth("azure")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          aria-busy={oauthBusy && oauthProvider === "azure"}
        >
          <span>{t.continueMicrosoft}</span>
        </button>

        {!showPhonePanel ? (
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

      {showPhonePanel ? (
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
