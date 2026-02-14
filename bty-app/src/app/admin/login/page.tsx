"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/admin/debug";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const getRedirectTo = () => {
    if (typeof window === "undefined") return "";
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${base.replace(/\/$/, "")}/auth/callback`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim() || !supabase) return;
    setError(null);
    setResetLoading(true);
    const redirectTo = getRedirectTo();
    if (!redirectTo || redirectTo.includes("localhost")) {
      setError("비밀번호 재설정 링크는 프로덕션 URL에서만 사용할 수 있습니다. NEXT_PUBLIC_SITE_URL을 설정하세요.");
      setResetLoading(false);
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo,
    });
    setResetLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900 mb-4">관리자 로그인</h1>
        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              placeholder="admin@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
        {!showReset ? (
          <p className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="text-sm text-neutral-600 hover:text-neutral-900 underline"
            >
              비밀번호 재설정
            </button>
          </p>
        ) : !resetSent ? (
          <form onSubmit={handleResetSubmit} className="mt-4 pt-4 border-t border-neutral-200 space-y-3">
            <label className="block text-sm font-medium text-neutral-700">재설정할 이메일</label>
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={resetLoading}
                className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                {resetLoading ? "전송 중..." : "재설정 메일 보내기"}
              </button>
              <button
                type="button"
                onClick={() => { setShowReset(false); setError(null); }}
                className="rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                취소
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-4 text-sm text-neutral-600 text-center">
            재설정 메일을 보냈습니다. 메일의 링크로 이동한 뒤 새 비밀번호를 설정해주세요.
          </p>
        )}
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-neutral-600">로딩 중...</div>}>
      <AdminLoginForm />
    </Suspense>
  );
}
