"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJson } from "@/lib/read-json";
import { sanitizeNext } from "@/lib/sanitize-next";

// ⚠️ 아래 login API/세션 플로우는 너희 프로젝트에 이미 있는 패턴 기준으로 작성.
// - /api/auth/login : email/password로 로그인 → access_token/refresh_token 반환(또는 쿠키 세팅)
// - /api/auth/session (POST) : 토큰으로 쿠키 세션 세팅
// - /api/auth/session (GET) : 쿠키 기반 getUser 확인
//
// 만약 지금 프로젝트에서 AuthContext.login()을 쓰고 있다면
// 이 파일 안에서 아래 doLogin() 대신 AuthContext.login() 호출로 바꿔도 됨.

type LoginResp =
  | { ok: true; access_token?: string; refresh_token?: string; user?: { id?: string; email?: string } }
  | { ok: false; error?: string; where?: string };

function parseErr(raw?: string) {
  if (!raw) return "";
  try {
    const obj = JSON.parse(raw) as { error?: string; message?: string };
    return obj.error ?? obj.message ?? raw;
  } catch {
    return raw;
  }
}

export default function LoginClient() {
  const sp = useSearchParams();
  const nextPath = useMemo(() => sanitizeNext(sp.get("next")), [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const doLogin = async () => {
    setErr(null);
    setLoading(true);
    try {
      // 1) 로그인
      const r1 = await fetchJson<LoginResp>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!r1.ok) {
        throw new Error(parseErr(r1.raw) || "Login failed");
      }

      const j1 = r1.json;
      if (!j1?.ok) {
        throw new Error(j1?.error || "Login failed");
      }

      // 2) 토큰이 오면 session POST로 쿠키 세팅 (프로젝트가 이 플로우면 유지)
      if (j1.access_token && j1.refresh_token) {
        const r2 = await fetchJson<{ ok?: boolean; error?: string }>("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: j1.access_token, refresh_token: j1.refresh_token }),
        });

        if (!r2.ok) {
          throw new Error(parseErr(r2.raw) || "Session POST failed");
        }
        if (!r2.json?.ok) {
          throw new Error(r2.json?.error || "Session POST failed");
        }
      }

      // 3) 세션 GET으로 최종 확인 (쿠키 반영 레이스 방지: 짧게 재시도)
      let okUser = false;
      for (let i = 0; i < 3; i++) {
        const r3 = await fetchJson<{ ok: boolean; user?: any; error?: string }>("/api/auth/session?_t=" + Date.now(), {
          cache: "no-store",
        });
        if (r3.ok && r3.json?.ok && r3.json.user) {
          okUser = true;
          break;
        }
        await new Promise((res) => setTimeout(res, 120));
      }

      if (!okUser) {
        throw new Error("세션 생성 실패(쿠키 미설정/미반영)");
      }

      // 4) next로 이동 (middleware 보호 경로면 여기서부터 정상 진입)
      window.location.assign(nextPath);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-2xl p-6 bg-white">
        <h1 className="text-xl font-semibold mb-1">BTY 로그인</h1>
        <p className="text-sm text-gray-600 mb-4">로그인 후 {nextPath} 로 이동합니다.</p>

        <label className="block text-sm mb-1">이메일</label>
        <input
          className="w-full border rounded-lg px-3 py-2 mb-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />

        <label className="block text-sm mb-1">비밀번호</label>
        <input
          className="w-full border rounded-lg px-3 py-2 mb-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          type="password"
          autoComplete="current-password"
        />

        {err ? <div className="text-sm text-red-600 mb-3">{err}</div> : null}

        <button
          className="w-full rounded-lg px-4 py-2 bg-black text-white disabled:opacity-60"
          onClick={doLogin}
          disabled={loading || !email || !password}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>

        <div className="text-xs text-gray-500 mt-3">
          쿠키 기반 세션으로 동작합니다. 로그인 성공 직후 새로고침/이동이 발생할 수 있습니다.
        </div>
      </div>
    </div>
  );
}
