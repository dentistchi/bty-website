"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

function isSafeNextPath(v: string | null): v is string {
  if (!v) return false;
  // 내부 경로만 허용 (오픈 리다이렉트 방지)
  if (!v.startsWith("/")) return false;
  if (v.startsWith("//")) return false;
  if (v.startsWith("/\\") || v.includes("://")) return false;
  return true;
}

export default function BtyLoginPage() {
  const sp = useSearchParams();
  const { user, loading, error, login } = useAuth();

  const nextPath = useMemo(() => {
    const raw = sp.get("next");
    return isSafeNextPath(raw) ? raw : "/bty";
  }, [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [localErr, setLocalErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ✅ 이미 로그인 상태면 자동 이동 (이동은 hard nav로)
  useEffect(() => {
    if (loading) return;
    if (user) {
      window.location.assign(nextPath);
    }
  }, [loading, user, nextPath]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr(null);

    const em = email.trim();
    if (!em || !password) {
      setLocalErr("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      // ✅ 이동은 AuthContext.login이 책임 (window.location.assign)
      await login(em, password, nextPath);
    } catch (err: any) {
      // login 내부에서 error state를 세팅하지만, 혹시 throw 되는 경우 대비
      setLocalErr(err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const shownError = localErr ?? error;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 16, padding: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>BTY 로그인</h1>
        <p style={{ marginTop: 0, marginBottom: 16, opacity: 0.75, fontSize: 14 }}>
          로그인 후 <b>{nextPath}</b> 로 이동합니다.
        </p>

        {shownError ? (
          <div
            style={{
              background: "rgba(255,0,0,0.06)",
              border: "1px solid rgba(255,0,0,0.15)",
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
              whiteSpace: "pre-wrap",
            }}
          >
            {shownError}
          </div>
        ) : null}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, opacity: 0.8 }}>이메일</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              disabled={loading || submitting}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                outline: "none",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, opacity: 0.8 }}>비밀번호</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={loading || submitting}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                outline: "none",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading || submitting}
            style={{
              marginTop: 6,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "black",
              color: "white",
              fontWeight: 700,
              cursor: loading || submitting ? "not-allowed" : "pointer",
              opacity: loading || submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "로그인 중..." : "로그인"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
            쿠키 기반 세션으로 동작합니다. 로그인 성공 시 새로고침/이동이 발생할 수 있습니다.
          </div>
        </form>
      </div>
    </div>
  );
}
