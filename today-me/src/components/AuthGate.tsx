"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { buildCrossSiteLoginUrl, getStoredToken } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const BTY_ORIGIN =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_BTY_URL || "http://localhost:3001"
    : "";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, login, register, logout, error, clearError } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      if (isRegister) await register(email, password);
      else await login(email, password);
    } catch {
      // error set in context
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sanctuary-text-soft">
        로딩 중…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-sanctuary-peach/50 bg-sanctuary-blush/40 p-6 shadow-sm">
          <h2 className="text-lg font-medium text-sanctuary-text">
            {isRegister ? "회원가입" : "로그인"}
          </h2>
          <p className="text-sm text-sanctuary-text-soft mt-1">
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
                "w-full rounded-xl border border-sanctuary-peach/60 bg-white/80 px-4 py-3",
                "focus:outline-none focus:ring-2 focus:ring-sanctuary-sage/50"
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
                "w-full rounded-xl border border-sanctuary-peach/60 bg-white/80 px-4 py-3",
                "focus:outline-none focus:ring-2 focus:ring-sanctuary-sage/50"
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
                "bg-sanctuary-sage/80 text-sanctuary-text hover:bg-sanctuary-sage"
              )}
            >
              {isRegister ? "가입하기" : "로그인"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); clearError(); }}
            className="mt-3 text-sm text-sanctuary-text-soft hover:underline"
          >
            {isRegister ? "이미 계정이 있어요" : "계정 만들기"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-sanctuary-peach/40 bg-sanctuary-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <span className="text-sm text-sanctuary-text-soft">{user.email}</span>
          <div className="flex items-center gap-2">
            <a
              href={buildCrossSiteLoginUrl(BTY_ORIGIN, getStoredToken() || "")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-sanctuary-accent hover:underline"
            >
              bty에서도 로그인
            </a>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-sanctuary-text-soft hover:underline"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
