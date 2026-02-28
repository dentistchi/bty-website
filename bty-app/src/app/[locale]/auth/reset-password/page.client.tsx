"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { LoadingFallback } from "@/components/bty-arena";

function ResetPasswordForm() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const loginPath = `/${locale}/bty/login`;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (supabase == null) {
      setHasSession(false);
      return;
    }
    const client = supabase;
    // URL 해시에서 복구 토큰이 오면 Supabase가 비동기로 세션을 세팅함. 잠시 기다린 뒤 한 번 더 확인.
    function checkSession() {
      client.auth.getSession().then(({ data: { session } }) => {
        setHasSession(!!session);
      });
    }
    checkSession();
    const timer = window.setTimeout(checkSession, 800);
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => {
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    const client = supabase;
    if (!client) {
      setError("연결 오류가 발생했습니다.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await client.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.replace(loginPath), 1500);
  };

  if (hasSession === null) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <LoadingFallback icon="⏳" message="확인 중..." />
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center px-4">
        <p className="text-neutral-700 text-center">
          세션이 없습니다. 비밀번호 재설정을 다시 요청해주세요.
        </p>
        <Link
          href={loginPath}
          className="mt-4 text-sm font-medium text-neutral-900 underline hover:no-underline"
        >
          로그인으로 이동
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center px-4">
        <p className="text-neutral-700 text-center">
          비밀번호가 변경되었습니다. 다시 로그인해주세요.
        </p>
        <p className="mt-2 text-sm text-neutral-500">잠시 후 로그인 페이지로 이동합니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900 mb-4">비밀번호 재설정</h1>
        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">새 비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              placeholder="6자 이상"
              minLength={6}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              비밀번호 확인
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              placeholder="다시 입력"
              minLength={6}
              required
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? "변경 중..." : "비밀번호 변경"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center px-4">
          <LoadingFallback icon="⏳" message="잠시만 기다려 주세요." />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
