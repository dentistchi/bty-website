"use client";

import React from "react";
import BtyTopNav from "@/components/bty/BtyTopNav";
import { arenaFetch } from "@/lib/http/arenaFetch";

type Row = {
  rank: number;
  codeName: string;
  subName: string;
  xpTotal: number;
};

type LeaderboardRes = {
  leaderboard?: Row[];
  nearMe?: Row[];
  top10?: Row[];
  myRank?: number | null;
  myXp?: number;
  count?: number;
};

export default function LeaderboardPage() {
  const [data, setData] = React.useState<LeaderboardRes | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError(null);
        const json = await arenaFetch<LeaderboardRes>("/api/arena/leaderboard");
        if (!cancelled) setData(json);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "FAILED_TO_LOAD");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = data?.nearMe?.length ? data.nearMe : (data?.leaderboard ?? []);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }}>
      <BtyTopNav />
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 14, opacity: 0.7 }}>bty</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Leaderboard</h1>
        <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>
          Seasonal XP · Code · Sub Name
        </div>
        {data?.myRank != null && (
          <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600 }}>
            Your rank: #{data.myRank} · {data.myXp ?? 0} XP
          </div>
        )}
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
                    <div style={{ fontWeight: 800, fontSize: 16 }}>
                      {r.codeName} · {r.subName}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Seasonal XP</div>
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
