"use client";

import { useMemo, useState } from "react";

async function forceCookieCommit() {
  try {
    await fetch("/api/auth/whoami", { method: "GET", cache: "no-store" });
  } catch {
    // ignore
  }
}

function safeNext(nextPath: string, locale: "en" | "ko") {
  if (!nextPath || typeof nextPath !== "string") return `/${locale}/bty`;
  if (!nextPath.startsWith("/")) return `/${locale}/bty`;
  if (nextPath.startsWith("//")) return `/${locale}/bty`;
  return nextPath;
}

export default function LoginClient({ nextPath, locale }: { nextPath: string; locale: "en" | "ko" }) {
  const next = useMemo(() => safeNext(nextPath, locale), [nextPath, locale]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const canSubmit = email.trim().length > 3 && password.length > 3 && !isLoading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsLoading(true);
    setError("");

    try {
      const loginUrl = next ? `/api/auth/login?next=${encodeURIComponent(next)}` : "/api/auth/login";
      const r = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: "include",
      });

      const data = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        next?: string;
        error?: string;
        detail?: string;
      };

      if (data.ok && typeof data.next === "string") {
        await forceCookieCommit();
        await new Promise((r) => setTimeout(r, 50));
        window.location.assign(data.next);
        return;
      }

      if (!r.ok) {
        const msg = data.detail ?? data.error ?? "Login failed";
        throw new Error(msg);
      }

      throw new Error(data.error ?? "Login failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-2xl p-6 bg-white">
        <h1 className="text-xl font-semibold mb-1">bty 로그인</h1>
        <p className="text-sm text-gray-600 mb-4">
          로그인 후 <span className="font-medium">{next}</span> 로 이동합니다.
        </p>

        <form onSubmit={onSubmit}>
          <label className="block text-sm mb-1">이메일</label>
          <input
            className="w-full border rounded-lg px-3 py-2 mb-3"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="block text-sm mb-1">비밀번호</label>
          <input
            className="w-full border rounded-lg px-3 py-2 mb-3"
            placeholder="••••••••"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error ? <div className="text-sm text-red-600 mb-3">{error}</div> : null}

          <button
            className="w-full rounded-lg px-4 py-2 bg-black text-white disabled:opacity-60"
            disabled={!canSubmit}
            type="submit"
          >
            {isLoading ? "로그인 중..." : "로그인"}
          </button>

          <div className="text-xs text-gray-500 mt-3">
            쿠키 기반 세션으로 동작합니다. 로그인 성공 직후 새로고침/이동이 발생할 수 있습니다.
          </div>
        </form>
      </div>
    </div>
  );
}
