"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { LoadingFallback, PageLoadingFallback, CardSkeleton } from "@/components/bty-arena";

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!hash || !hash.startsWith("#")) return params;
  for (const pair of hash.slice(1).split("&")) {
    const [k, v] = pair.split("=");
    if (k) params[decodeURIComponent(k)] = v ? decodeURIComponent(v.replace(/\+/g, " ")) : "";
  }
  return params;
}

type PageState = "loading" | "expired" | "no-session" | "ready" | "success";

function ResetPasswordForm() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const searchParams = useSearchParams();
  const loginPath = `/${locale}/bty/login`;
  const forgotPath = `/${locale}/bty/forgot-password`;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setPageState("no-session");
      return;
    }
    const client = supabase;
    let mounted = true;

    async function init() {
      // 1. Check for otp_expired in URL hash
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const hashParams = parseHashParams(hash);
      if (hashParams.error_code === "otp_expired") {
        if (mounted) setPageState("expired");
        return;
      }

      // 2. PKCE flow: ?code=...&type=recovery in search params
      const code = searchParams.get("code");
      const searchType = searchParams.get("type");
      if (code && searchType === "recovery") {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (error) {
          const { data } = await client.auth.getSession();
          if (!mounted) return;
          setPageState(data.session?.user ? "ready" : "no-session");
          return;
        }
        setPageState("ready");
        return;
      }

      // 3. Implicit flow: #access_token=...&type=recovery in hash
      const accessToken = hashParams.access_token;
      const refreshToken = hashParams.refresh_token;
      const hashType = hashParams.type;
      if (accessToken && refreshToken && hashType === "recovery") {
        const { error } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!mounted) return;
        if (error) {
          setPageState("no-session");
          return;
        }
        setPageState("ready");
        return;
      }

      // 4. Existing session check (with 800ms retry for async hash token processing)
      const getHasSession = async () => {
        const { data } = await client.auth.getSession();
        return !!data.session?.user;
      };

      if (await getHasSession()) {
        if (mounted) setPageState("ready");
        return;
      }
      await new Promise<void>((r) => setTimeout(r, 800));
      if (!mounted) return;
      setPageState((await getHasSession()) ? "ready" : "no-session");
    }

    void init();
    return () => {
      mounted = false;
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (password.length < 6) {
      setFormError(locale === "ko" ? "비밀번호는 6자 이상이어야 합니다." : "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setFormError(locale === "ko" ? "비밀번호가 일치하지 않습니다." : "Passwords do not match.");
      return;
    }
    if (!supabase) {
      setFormError(locale === "ko" ? "연결 오류가 발생했습니다." : "Connection error.");
      return;
    }
    setSubmitLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitLoading(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setPageState("success");
    setTimeout(() => router.replace(loginPath), 1500);
  };

  if (pageState === "loading") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <LoadingFallback icon="⏳" message={locale === "ko" ? "인증 확인 중..." : "Verifying..."} />
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm rounded border border-amber-200 bg-amber-50 px-4 py-6 text-center">
          <p className="text-amber-800 font-medium">
            {locale === "ko"
              ? "재설정 링크가 만료되었습니다. 새 링크를 요청해주세요."
              : "Reset link expired. Request a new link."}
          </p>
          <Link
            href={forgotPath}
            className="mt-4 inline-block text-sm font-medium text-neutral-900 underline hover:no-underline"
          >
            {locale === "ko" ? "새 링크 요청" : "Request a new link"}
          </Link>
        </div>
      </div>
    );
  }

  if (pageState === "no-session") {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center px-4">
        <p className="text-neutral-700 text-center">
          {locale === "ko"
            ? "세션이 없습니다. 비밀번호 재설정을 다시 요청해주세요."
            : "No valid session. Please request a new reset link."}
        </p>
        <Link
          href={forgotPath}
          className="mt-4 text-sm font-medium text-neutral-900 underline hover:no-underline"
        >
          {locale === "ko" ? "새 링크 요청" : "Request a new link"}
        </Link>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center px-4">
        <p className="text-neutral-700 text-center">
          {locale === "ko"
            ? "비밀번호가 변경되었습니다. 다시 로그인해주세요."
            : "Password updated. Please sign in."}
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          {locale === "ko" ? "잠시 후 로그인 페이지로 이동합니다." : "Redirecting to sign in shortly."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900 mb-4">
          {locale === "ko" ? "비밀번호 재설정" : "Reset password"}
        </h1>
        {formError && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              {locale === "ko" ? "새 비밀번호" : "New password"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              placeholder={locale === "ko" ? "6자 이상" : "At least 6 characters"}
              minLength={6}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              {locale === "ko" ? "비밀번호 확인" : "Confirm password"}
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              placeholder={locale === "ko" ? "다시 입력" : "Re-enter password"}
              minLength={6}
              required
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={submitLoading}
            className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {submitLoading
              ? (locale === "ko" ? "변경 중..." : "Updating...")
              : (locale === "ko" ? "비밀번호 변경" : "Change password")}
          </button>
          {submitLoading && (
            <div className="mt-3">
              <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
            </div>
          )}
        </form>
        <Link
          href={loginPath}
          className="mt-4 inline-block text-sm text-neutral-600 hover:text-neutral-900 underline"
        >
          {locale === "ko" ? "로그인으로 돌아가기" : "Back to sign in"}
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center px-4">
          <PageLoadingFallback />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
