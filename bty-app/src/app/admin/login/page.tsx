"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function AdminLoginForm() {
  const searchParams = useSearchParams();

  const nextPath =
    searchParams.get("next") ||
    searchParams.get("callbackUrl") ||
    "/admin/debug";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const r = await fetch("/api/auth/session", { credentials: "include" }).catch(() => null);
      if (!r || cancelled) return;
      const j = await r.json().catch(() => null);
      if (!cancelled && j?.user) window.location.assign(nextPath);
    }
    check();
    return () => { cancelled = true; };
  }, [nextPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setError(json?.message || "로그인에 실패했습니다.");
        return;
      }

      // 성공
      window.location.assign(nextPath);
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-800">Admin 로그인</h1>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" placeholder="이메일" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" placeholder="비밀번호" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={loading} type="submit" className="w-full rounded bg-neutral-800 py-2 text-sm font-medium text-white disabled:opacity-50">
            {loading ? "로그인 중…" : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div>로딩…</div>}>
      <AdminLoginForm />
    </Suspense>
  );
}
