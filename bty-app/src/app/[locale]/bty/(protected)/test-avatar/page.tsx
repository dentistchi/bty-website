"use client";

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import BtyTopNav from "@/components/bty/BtyTopNav";
import { arenaFetch } from "@/lib/http/arenaFetch";

/**
 * Phase 3 아바타 수동 테스트 페이지 (2·4·5·6)
 * 로그인 후 /ko/bty/test-avatar 또는 /en/bty/test-avatar 접속
 */
export default function TestAvatarPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en";
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
      const json = await res.json();
      setResult(`PATCH ${res.status}: ${JSON.stringify(json)}`);
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const t = locale === "ko"
    ? {
        title: "Phase 3 아바타 테스트",
        test2: "테스트 2: 대시보드 아바타",
        test2Desc: "대시보드로 이동해 아바타(또는 이니셜 폴백)가 보이는지 확인",
        test4: "테스트 4: PATCH profile 저장",
        test4Desc: "URL 입력 후 저장 → 대시보드 새로고침 시 이미지 표시 확인",
        test5: "테스트 5: avatarUrl null/빈 문자열",
        test5Desc: "아바타 지우기 → 폴백만 보이는지 확인",
        test6: "테스트 6: 외부 URL 이미지",
        test6Desc: "외부 URL 저장 (예: picsum) → 이미지 깨짐 없이 로드되는지 확인",
        save: "저장",
        clear: "지우기",
        dashboard: "대시보드로 이동",
      }
    : {
        title: "Phase 3 Avatar Test",
        test2: "Test 2: Dashboard avatar",
        test2Desc: "Go to dashboard and verify avatar (or initials fallback) visible",
        test4: "Test 4: PATCH profile save",
        test4Desc: "Enter URL → Save → Refresh dashboard to see image",
        test5: "Test 5: avatarUrl null/empty",
        test5Desc: "Clear avatar → Verify only fallback shows",
        test6: "Test 6: External URL image",
        test6Desc: "Save external URL → Verify image loads without CORS issues",
        save: "Save",
        clear: "Clear",
        dashboard: "Go to dashboard",
      };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <BtyTopNav />
      <h1 style={{ fontSize: 22, marginTop: 18 }}>{t.title}</h1>
      <p style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>
        PHASE_3_CHECKLIST.md 테스트 2·4·5·6
      </p>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Test 2 */}
        <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>{t.test2}</h2>
          <p style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>{t.test2Desc}</p>
          <Link
            href={`/${locale}/bty/dashboard`}
            style={{ display: "inline-block", marginTop: 8, fontSize: 14, color: "#5B4B8A" }}
          >
            → {t.dashboard}
          </Link>
        </section>

        {/* Test 4, 5, 6 */}
        <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>{t.test4}</h2>
          <p style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>{t.test4Desc}</p>
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
              {t.save}
            </button>
          </div>
        </section>

        <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>{t.test5}</h2>
          <p style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>{t.test5Desc}</p>
          <button
            onClick={() => runPATCH(null)}
            style={{ marginTop: 8, padding: "8px 16px", background: "#666", color: "white", border: "none", borderRadius: 8 }}
          >
            {t.clear}
          </button>
        </section>

        <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>{t.test6}</h2>
          <p style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>{t.test6Desc}</p>
          <button
            onClick={() => runPATCH("https://picsum.photos/100")}
            style={{ marginTop: 8, padding: "8px 16px", background: "#5B4B8A", color: "white", border: "none", borderRadius: 8 }}
          >
            {t.save} (picsum)
          </button>
        </section>

        {result && (
          <pre style={{ padding: 12, background: "#f5f5f5", borderRadius: 8, fontSize: 12, overflow: "auto" }}>
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}
