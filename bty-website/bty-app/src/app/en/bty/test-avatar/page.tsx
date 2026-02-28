"use client";

import React from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";

/**
 * Phase 3 Avatar Test (2·4·5·6)
 * bty-website app does not have Arena API — PATCH will 404.
 * Full test: run btytrainingcenter/bty-app, then visit /en/bty/test-avatar
 */
export default function TestAvatarPageEn() {
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
          "⚠️ Arena API not available. This app (bty-website) does not have /api/arena/profile.\n\nFull test: run btytrainingcenter/bty-app, then visit /en/bty/test-avatar"
        );
      }
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <Nav locale="en" pathname="/en/bty/test-avatar" />
      <h1 style={{ fontSize: 22, marginTop: 18 }}>Phase 3 Avatar Test</h1>
      <p style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>
        PHASE_3_CHECKLIST.md tests 2·4·5·6
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
        ⚠️ <strong>bty-website</strong> does not have Arena API. PATCH /api/arena/profile will return 404.
        <br />
        For full avatar tests, run <strong>btytrainingcenter/bty-app</strong> and visit{" "}
        <code>/en/bty/test-avatar</code>.
      </div>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Test 2: Dashboard avatar</h2>
          <p style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>
            Go to dashboard and verify avatar (or initials fallback) is visible
          </p>
          <Link href="/en/bty" style={{ display: "inline-block", marginTop: 8, fontSize: 14, color: "#5B4B8A" }}>
            → Go to dashboard
          </Link>
        </section>

        <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Tests 4·5·6: PATCH profile</h2>
          <p style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>
            Requires Arena API. Test in bty-app (full version).
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
              Save
            </button>
            <button
              onClick={() => runPATCH(null)}
              style={{ padding: "8px 16px", background: "#666", color: "white", border: "none", borderRadius: 8 }}
            >
              Clear
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
