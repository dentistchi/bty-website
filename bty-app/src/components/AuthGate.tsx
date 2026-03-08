"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { LoadingFallback } from "@/components/bty-arena";

/** CENTER_PAGE_IMPROVEMENT_SPEC §2: loadingMessage 있으면 locale에 맞는 로딩 문구 사용 */
export function AuthGate({
  children,
  loadingMessage,
}: {
  children: React.ReactNode;
  /** Optional: e.g. t.center.loading for locale-aware "Please wait…" / "잠시만 기다려 주세요." */
  loadingMessage?: string;
}) {
  const { user, loading, login, register, error, clearError } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    console.log("login clicked");

    try {
      if (isRegister) await register(email, password);
      else await login(email, password);

      console.log("login ok, redirecting...");
      window.location.assign("/bty"); // ✅ 결정타
    } catch (err) {
      // error state는 login/register 내부에서 setError 하거나 throw 메세지로 처리
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        aria-busy="true"
        aria-label={loadingMessage ?? "잠시만 기다려 주세요."}
      >
        <LoadingFallback icon="⏳" message={loadingMessage ?? "잠시만 기다려 주세요."} withSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-foundry-purple-muted bg-foundry-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foundry-purple-dark">
            {isRegister ? "회원가입" : "로그인"}
          </h2>
          <p className="text-sm text-foundry-ink-soft mt-1">
            Center와 bty는 하나의 계정으로 이용해요.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              required
              className={cn(
                "w-full rounded-xl border border-foundry-purple-muted px-4 py-3",
                "focus:outline-none focus:ring-2 focus:ring-foundry-purple/30"
              )}
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 (6자 이상)"
              required
              minLength={6}
              className={cn(
                "w-full rounded-xl border border-foundry-purple-muted px-4 py-3",
                "focus:outline-none focus:ring-2 focus:ring-foundry-purple/30"
              )}
            />

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              aria-label={isRegister ? "회원가입 제출" : "로그인 제출"}
              className={cn(
                "w-full py-3 rounded-xl font-medium",
                "bg-foundry-purple text-foundry-white hover:bg-foundry-purple-dark"
              )}
            >
              {isRegister ? "회원가입" : "로그인"}
            </button>

            <button
              type="button"
              onClick={() => setIsRegister((v) => !v)}
              className="w-full text-sm text-foundry-ink-soft underline underline-offset-2"
            >
              {isRegister ? "이미 계정이 있어요 (로그인)" : "계정이 없어요 (회원가입)"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
