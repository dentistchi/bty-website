"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum";

type Row = {
  rank: number;
  userId: string;
  codeName: string;
  xpTotal: number;
  level: number;
  tier: Tier;
  progressPct: number;
  codeHidden: boolean;
};

export default function LeaderboardPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/arena/leaderboard", { method: "GET", credentials: "same-origin" });
        const json = (await res.json().catch(() => ({}))) as {
          leaderboard?: Row[];
          error?: string;
        };

        if (!res.ok) {
          const msg = json?.error ? String(json.error) : `HTTP_${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) setRows((json.leaderboard ?? []) as Row[]);
      } catch (e: unknown) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "FAILED_TO_LOAD");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>bty</div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Leaderboard</h1>
          <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>
            Weekly XP ranking (Code Name only)
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href={`/${locale}/bty/dashboard`}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            Dashboard
          </Link>
          <Link
            href={`/${locale}/bty-arena`}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #111",
              textDecoration: "none",
              color: "white",
              background: "#111",
            }}
          >
            Arena
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: 18, border: "1px solid #eee", borderRadius: 14 }}>
        {loading && <div style={{ opacity: 0.8 }}>Loading…</div>}
        {error && (
          <div
            style={{
              padding: 12,
              border: "1px solid #f1c0c0",
              borderRadius: 12,
              background: "#fff7f7",
            }}
          >
            <div style={{ fontWeight: 800 }}>Failed</div>
            <div style={{ marginTop: 6, opacity: 0.85 }}>{error}</div>
          </div>
        )}

        {!loading && !error && (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r) => (
              <div
                key={r.rank}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid #eee",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      border: "1px solid #eee",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 800,
                    }}
                  >
                    {r.rank}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{r.codeName}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      Level {r.level} · {r.tier} · Progress {r.progressPct}%
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{r.xpTotal}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Weekly XP</div>
                </div>
              </div>
            ))}

            {rows.length === 0 && (
              <div style={{ opacity: 0.75 }}>No data yet. Play Arena to generate weekly XP.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
