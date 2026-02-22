"use client";

import React from "react";

type WeeklyXpRes = { weekStartISO: string; weekEndISO: string; xpTotal: number; count: number };
type RunRow = { run_id: string; scenario_id: string; locale: string; started_at: string; status: string };
type RunsRes = { runs: RunRow[] };

const STREAK_KEY = "btyArenaStreak:v1";

function readLocalStreak(): number {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { streak?: number };
    return typeof parsed.streak === "number" ? parsed.streak : 0;
  } catch {
    return 0;
  }
}

export default function DashboardClient() {
  const [weekly, setWeekly] = React.useState<WeeklyXpRes | null>(null);
  const [runs, setRuns] = React.useState<RunRow[]>([]);
  const [streak, setStreak] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setStreak(readLocalStreak());

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [w, r] = await Promise.all([
          fetch("/api/arena/weekly-xp").then(async (res) => {
            if (!res.ok) throw new Error(`weekly-xp ${res.status}`);
            return (await res.json()) as WeeklyXpRes;
          }),
          fetch("/api/arena/runs?limit=10").then(async (res) => {
            if (!res.ok) throw new Error(`runs ${res.status}`);
            return (await res.json()) as RunsRes;
          }),
        ]);

        if (!alive) return;
        setWeekly(w);
        setRuns(r.runs ?? []);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, opacity: 0.7 }}>bty</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Dashboard</h1>
        <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>Your arena progress at a glance.</div>
      </div>

      {loading && <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>Loading…</div>}

      {!loading && error && (
        <div style={{ padding: 14, border: "1px solid #f2c", borderRadius: 12 }}>
          <div style={{ fontWeight: 700 }}>Error</div>
          <div style={{ marginTop: 6 }}>{error}</div>
          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
            (Logged out should return 401.)
          </div>
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>COMPETITION XP</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{weekly?.xpTotal ?? 0}</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>Events counted: {weekly?.count ?? 0}</div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
              {weekly?.weekStartISO?.slice(0, 10)} → {weekly?.weekEndISO?.slice(0, 10)}
            </div>
          </div>

          <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>RECENT RUNS</div>
            {runs.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No runs yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {runs.map((r) => (
                  <div
                    key={r.run_id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: 10,
                      border: "1px solid #f0f0f0",
                      borderRadius: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.scenario_id}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {r.started_at ? new Date(r.started_at).toLocaleString() : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{r.status}</div>
                      <div style={{ fontSize: 12, opacity: 0.6 }}>{r.locale}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>STREAK</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{streak}</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              (MVP: local streak. Supabase profile streak later.)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
