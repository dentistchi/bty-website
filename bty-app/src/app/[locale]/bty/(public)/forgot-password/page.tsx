"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";

export default function ForgotPasswordClient() {
  const pathname = usePathname() ?? "";
  const locale: "en" | "ko" = pathname.startsWith("/ko") ? "ko" : "en";
  const t = getMessages(locale as Locale).login;

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim();
    if (!em) {
      setError("이메일을 입력해주세요.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabase();
      const redirectTo = `${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/auth/reset-password`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(em, { redirectTo });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.forgotPasswordError);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md border rounded-2xl p-6 bg-white">
          <p className="text-gray-700 mb-4">{t.forgotPasswordSent}</p>
          <Link
            href={`/${locale}/bty/login`}
            className="text-sm font-medium text-black underline hover:no-underline"
          >
            {t.password} · {locale === "ko" ? "로그인으로 돌아가기" : "Back to sign in"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-2xl p-6 bg-white">
        <h1 className="text-xl font-semibold mb-1">
          {locale === "ko" ? "비밀번호 찾기" : "Forgot password"}
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          {locale === "ko"
            ? "가입한 이메일을 입력하면 재설정 링크를 보내드립니다."
            : "Enter your email and we’ll send you a reset link."}
        </p>

        <form onSubmit={onSubmit}>
          <label className="block text-sm mb-1">{t.email}</label>
          <input
            className="w-full border rounded-lg px-3 py-2 mb-3"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          {error ? <div className="text-sm text-red-600 mb-3">{error}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2 bg-black text-white disabled:opacity-60"
          >
            {loading ? (locale === "ko" ? "전송 중…" : "Sending…") : locale === "ko" ? "재설정 링크 받기" : "Send reset link"}
          </button>
        </form>

        <Link
          href={`/${locale}/bty/login`}
          className="mt-4 inline-block text-sm text-gray-600 underline hover:no-underline"
        >
          {locale === "ko" ? "로그인으로 돌아가기" : "Back to sign in"}
        </Link>
      </div>
    </div>
  );
}
