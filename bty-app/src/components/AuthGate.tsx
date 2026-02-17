"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function AuthGate({ children }: { children: React.ReactNode }) {
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-dear-sage/30 border-t-dear-sage rounded-full animate-spin mb-3" />
          <p className="text-sm text-dear-charcoal-soft">로딩 중…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-dojo-purple-muted bg-dojo-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-dojo-purple-dark">
            {isRegister ? "회원가입" : "로그인"}
          </h2>
          <p className="text-sm text-dojo-ink-soft mt-1">
            Dear Me와 bty는 하나의 계정으로 이용해요.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              required
              className={cn(
                "w-full rounded-xl border border-dojo-purple-muted px-4 py-3",
                "focus:outline-none focus:ring-2 focus:ring-dojo-purple/30"
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
                "w-full rounded-xl border border-dojo-purple-muted px-4 py-3",
                "focus:outline-none focus:ring-2 focus:ring-dojo-purple/30"
              )}
            />

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className={cn(
                "w-full py-3 rounded-xl font-medium",
                "bg-dojo-purple text-dojo-white hover:bg-dojo-purple-dark"
              )}
            >
              {isRegister ? "회원가입" : "로그인"}
            </button>

            <button
              type="button"
              onClick={() => setIsRegister((v) => !v)}
              className="w-full text-sm text-dojo-ink-soft underline underline-offset-2"
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
