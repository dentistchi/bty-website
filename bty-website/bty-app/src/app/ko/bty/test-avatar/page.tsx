"use client";

import React from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";

/**
 * Phase 3 아바타 수동 테스트 페이지 (2·4·5·6)
 * /ko/bty/test-avatar — bty-website 앱에는 Arena API가 없어 PATCH가 404됩니다.
 */
export default function TestAvatarPageKo() {
  const [result, setResult] = React.useState<string>("");
  const [urlInput, setUrlInput] = React.useState("https://picsum.photos/100");

  const runPATCH = async (avatarUrl: string | null) => {
    try {
      const body = avatarUrl === null ? { avatarUrl: null } : { avatarUrl };
      const res = await fetch("/api/arena/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      setResult(`PATCH ${res.status}: ${JSON.stringify(json)}`);
      if (res.status === 404) {
        setResult(
          "⚠️ Arena API가 없습니다. 이 앱(bty-website)에는 /api/arena/profile이 없어요.\n\n전체 테스트: btytrainingcenter/bty-app 에서 npm run dev 후 /ko/bty/test-avatar 접속"
        );
      }
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <Nav locale="ko" pathname="/ko/bty/test-avatar" />
      <h1 style={{ fontSize: 22, marginTop: 18 }}>Phase 3 아바타 테스트</h1>
      <p style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>
        PHASE_3_CHECKLIST.md 테스트 2·4·5·6
      </p>
      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: "#fff8e6",
          border: "1px solid #e6d98a",
          borderRadius: 8,
          fontSize: 13,
        }}
      >
        ⚠️ <strong>bty-website</strong>에는 Arena API가 없습니다. PATCH /api/arena/profile 호출 시 404가 납니다.
        <br />
        전체 아바타 테스트는 <strong>btytrainingcenter/bty-app</strong>에서 실행 후{" "}
        <code>/ko/bty/test-avatar</code> 로 접속하세요.
      </div>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>테스트 2: 대시보드 아바타</h2>
          <p style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>
            대시보드로 이동해 아바타(또는 이니셜 폴백)가 보이는지 확인
          </p>
          <Link href="/bty" style={{ display: "inline-block", marginTop: 8, fontSize: 14, color: "#5B4B8A" }}>
            → 대시보드로 이동
          </Link>
        </section>

        <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>테스트 4·5·6: PATCH profile</h2>
          <p style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>
            Arena API 필요. bty-app(전체 버전)에서 테스트하세요.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              style={{ flex: 1, minWidth: 200, padding: 8 }}
            />
            <button
              onClick={() => runPATCH(urlInput.trim() || null)}
              style={{ padding: "8px 16px", background: "#5B4B8A", color: "white", border: "none", borderRadius: 8 }}
            >
              저장
            </button>
            <button
              onClick={() => runPATCH(null)}
              style={{ padding: "8px 16px", background: "#666", color: "white", border: "none", borderRadius: 8 }}
            >
              지우기
            </button>
          </div>
        </section>

        {result && (
          <pre style={{ padding: 12, background: "#f5f5f5", borderRadius: 8, fontSize: 12, overflow: "auto", whiteSpace: "pre-wrap" }}>
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}
