"use client";

import { useMemo, useState } from "react";
import { fetchJson } from "@/lib/read-json";

function safeNext(nextPath: string) {
  // 오픈리다이렉트 방지: 같은 오리진 내부 경로만 허용
  if (!nextPath || typeof nextPath !== "string") return "/bty";
  if (!nextPath.startsWith("/")) return "/bty";
  if (nextPath.startsWith("//")) return "/bty";
  return nextPath;
}

export default function LoginClient({ nextPath }: { nextPath: string }) {
  const next = useMemo(() => safeNext(nextPath), [nextPath]);

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
      // ✅ 로그인 엔드포인트 호출
      // 서버가 쿠키를 Set-Cookie로 내려주고, fetchJson은 credentials: "include" 이라 쿠키 저장 가능
      const r = await fetchJson<{ ok?: boolean; error?: string }>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!r.ok || !r.json?.ok) {
        // 응답이 JSON이 아닐 수도 있어 raw 우선
        let msg = r.raw || r.json?.error || "Login failed";
        try {
          const obj = JSON.parse(r.raw ?? "") as { error?: string; message?: string };
          msg = obj.error ?? obj.message ?? msg;
        } catch {}
        throw new Error(msg);
      }

      // ✅ 로그인 성공 후: next로 이동 (/bty 루트면 /bty/mentor로 보정해 404 방지)
      const dest = next === "/bty" ? "/bty/mentor" : next;
      window.location.assign(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-2xl p-6 bg-white">
        <h1 className="text-xl font-semibold mb-1">BTY 로그인</h1>
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
