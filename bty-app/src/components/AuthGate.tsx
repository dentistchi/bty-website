"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { buildCrossSiteLoginUrl, getStoredToken } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const TODAY_ME_ORIGIN =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_TODAY_ME_URL || "http://localhost:3000"
    : "";
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
    } catch (err) {
      // error is set by login/register throwing; we show it below
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-dojo-ink-soft">
        로딩 중…
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
            Today-Me와 bty는 하나의 계정으로 이용해요.
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
              {isRegister ? "가입하기" : "로그인"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              clearError();
            }}
            className="mt-3 text-sm text-dojo-purple hover:underline"
          >
            {isRegister ? "이미 계정이 있어요" : "계정 만들기"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-dojo-purple-muted bg-dojo-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <span className="text-sm text-dojo-ink-soft">{user.email}</span>
          <div className="flex items-center gap-2">
            <a
              href={buildCrossSiteLoginUrl(
                TODAY_ME_ORIGIN,
                getStoredToken() || ""
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-dojo-purple hover:underline"
            >
              Today-Me에서도 로그인
            </a>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-dojo-ink-soft hover:underline"
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
