"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const VALID_NEXT_PATHS = ["/admin/debug", "/admin/users", "/admin/organizations"];
function resolveNext(next: string | null): string {
  if (!next) return "/admin/debug";
  if (VALID_NEXT_PATHS.includes(next)) return next;
  return "/admin/debug";
}

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") || searchParams.get("callbackUrl") || null;
  const nextPath = resolveNext(rawNext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkEnv() {
      const r = await fetch("/api/debug", { credentials: "include" }).catch(() => null);
      if (!r || cancelled) return;
      const j = await r.json().catch(() => null);
      if (cancelled) return;
      if (!j?.hasUrl || !j?.hasAnon) {
        const msg = "Supabase 환경 변수가 설정되지 않았습니다. (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)";
        setEnvError(msg);
        if (typeof console !== "undefined") console.error("[admin/login]", msg, j);
      }
    }
    checkEnv();
  }, []);

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
        const msg = json?.message || "로그인에 실패했습니다.";
        setError(msg);
        if (res.status === 500 && msg.includes("Supabase")) {
          if (typeof console !== "undefined") console.error("[admin/login] 500:", msg, "env가 런타임(Worker)에 주입되지 않았을 수 있습니다.");
        }
        return;
      }

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
        {envError && <p className="mt-2 text-sm text-amber-700 bg-amber-50 p-2 rounded">{envError}</p>}
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
