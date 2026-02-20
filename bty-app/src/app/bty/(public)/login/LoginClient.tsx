"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJson } from "@/lib/read-json";

function safeMsg(raw?: string) {
  if (!raw) return "";
  try {
    const o = JSON.parse(raw) as { error?: string; message?: string };
    return o.error ?? o.message ?? raw;
  } catch {
    return raw;
  }
}

export default function LoginClient() {
  const sp = useSearchParams();
  const next = useMemo(() => sp.get("next") || "/bty", [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const can = !!email && !!password && !busy;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can) return;

    setBusy(true);
    setErr(null);

    // ✅ "무조건 Network에 /api/auth/login이 찍히게" 보장
    const r = await fetchJson<{ ok?: boolean; error?: string }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!r.ok) {
      setErr(safeMsg(r.raw) || `Login failed (${r.status})`);
      setBusy(false);
      return;
    }

    // 성공이면 next로 이동 (쿠키 기반이면 새로고침이 제일 안전)
    window.location.assign(next);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md border rounded-2xl p-6 bg-white">
        <h1 className="text-xl font-semibold mb-1">BTY 로그인</h1>
        <p className="text-sm text-gray-600 mb-4">로그인 후 {next} 로 이동합니다.</p>

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

        {err ? <div className="text-sm text-red-600 mb-3">{err}</div> : null}

        <button
          className="w-full rounded-lg px-4 py-2 bg-black text-white disabled:opacity-60"
          disabled={!can}
          type="submit"
        >
          {busy ? "로그인 중..." : "로그인"}
        </button>

        <div className="text-xs text-gray-500 mt-3">
          쿠키 기반 세션으로 동작합니다. 로그인 성공 직후 새로고침/이동이 발생할 수 있습니다.
        </div>
      </form>
    </div>
  );
}
