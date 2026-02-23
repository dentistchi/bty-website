"use client";

import React from "react";
import { useParams } from "next/navigation";
import BtyTopNav from "@/components/bty/BtyTopNav";

type WeeklyXpRes = { weekStartISO?: string | null; weekEndISO?: string | null; xpTotal: number; count?: number };
type CoreXpRes = { coreXpTotal: number; stage: number; stageProgress: number; codeName: string | null; codeHidden: boolean };
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

/** SPEC 9-3: level = floor(xpTotal/100)+1, tier Bronze|Silver|Gold|Platinum, progressPct = xpTotal % 100 */
function computeLevelTier(xpTotal: number) {
  const safe = Math.max(0, Math.floor(xpTotal || 0));
  const level = Math.floor(safe / 100) + 1;
  let tier: "Bronze" | "Silver" | "Gold" | "Platinum" = "Bronze";
  if (safe >= 300) tier = "Platinum";
  else if (safe >= 200) tier = "Gold";
  else if (safe >= 100) tier = "Silver";
  const progressPct = safe % 100;
  return { level, tier, progressPct };
}

export default function DashboardClient() {
  const params = useParams();
  const locale = (params?.locale as "en" | "ko") || "en";

  const [weekly, setWeekly] = React.useState<WeeklyXpRes | null>(null);
  const [core, setCore] = React.useState<CoreXpRes | null>(null);
  const [runs, setRuns] = React.useState<RunRow[]>([]);
  const [streak, setStreak] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [codeNameDraft, setCodeNameDraft] = React.useState("");
  const [codeNameSaving, setCodeNameSaving] = React.useState(false);
  const [codeNameError, setCodeNameError] = React.useState<string | null>(null);

  async function saveCodeName() {
    try {
      setCodeNameSaving(true);
      setCodeNameError(null);
      const res = await fetch("/api/arena/code-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeName: codeNameDraft }),
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        reason?: string;
        codeName?: string;
        codeHidden?: boolean;
      };
      if (!res.ok) {
        const msg = json?.reason ? `${json.error ?? "Error"} (${json.reason})` : (json?.error ?? `HTTP_${res.status}`);
        throw new Error(msg);
      }
      const next = await fetch("/api/arena/core-xp", { credentials: "same-origin" }).then(async (r) =>
        r.ok ? ((await r.json()) as CoreXpRes) : core
      );
      if (next) setCore(next);
      setCodeNameDraft("");
    } catch (e: unknown) {
      setCodeNameError(e instanceof Error ? e.message : "FAILED_TO_SAVE");
    } finally {
      setCodeNameSaving(false);
    }
  }

  React.useEffect(() => {
    let alive = true;
    setStreak(readLocalStreak());

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const w = await fetch("/api/arena/weekly-xp")
          .then(async (res) => {
            if (!res.ok) throw new Error(`weekly-xp ${res.status}`);
            return (await res.json()) as WeeklyXpRes;
          })
          .catch(() => ({ xpTotal: 0 } as WeeklyXpRes));

        const [r, c] = await Promise.all([
          fetch("/api/arena/runs?limit=10")
            .then(async (res) => (res.ok ? ((await res.json()) as RunsRes) : { runs: [] }))
            .catch(() => ({ runs: [] as RunRow[] })),
          fetch("/api/arena/core-xp")
            .then(async (res) =>
              res.ok
                ? ((await res.json()) as CoreXpRes)
                : ({ coreXpTotal: 0, stage: 1, stageProgress: 0, codeName: null, codeHidden: true })
            )
            .catch(() => ({ coreXpTotal: 0, stage: 1, stageProgress: 0, codeName: null, codeHidden: true })),
        ]);

        if (!alive) return;
        setWeekly(w);
        setRuns(r.runs ?? []);
        setCore(c);
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

  const xpTotal = weekly?.xpTotal ?? 0;
  const { level, tier, progressPct } = computeLevelTier(xpTotal);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      <BtyTopNav locale={locale} />
      <div style={{ marginTop: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 14, opacity: 0.7 }}>bty</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Dashboard</h1>
        <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>Your arena progress at a glance.</div>
      </div>

      {loading && <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>Loading…</div>}

      {!loading && error && (
        <div style={{ padding: 14, border: "1px solid #f2c", borderRadius: 12 }}>
          <div style={{ fontWeight: 700 }}>Error</div>
          <div style={{ marginTop: 6 }}>{error}</div>
          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>(Logged out should return 401.)</div>
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>COMPETITION XP</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{xpTotal}</div>
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  <b>Level</b> {level}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  <b>Tier</b> {tier}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  <b>Progress</b> {progressPct}%
                </div>
              </div>
              <div
                style={{
                  marginTop: 8,
                  height: 10,
                  borderRadius: 999,
                  border: "1px solid #eee",
                  overflow: "hidden",
                }}
              >
                <div style={{ height: "100%", width: `${progressPct}%`, background: "#111" }} />
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>Events counted: {weekly?.count ?? 0}</div>
            {weekly?.weekStartISO != null && weekly?.weekEndISO != null && (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
                {String(weekly.weekStartISO).slice(0, 10)} → {String(weekly.weekEndISO).slice(0, 10)}
              </div>
            )}
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
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>CORE XP</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{core?.coreXpTotal ?? 0}</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              Stage {core?.stage ?? 1} · Progress {core?.stageProgress ?? 0}/100
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
              Code Name: {core?.codeHidden ? "Hidden" : core?.codeName ?? "Unassigned"}
            </div>
          </div>

          <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>CODE NAME</div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  {core?.codeHidden ? "Hidden-777" : (core?.codeName ?? "Not set")}
                </div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
                  {core?.codeHidden
                    ? "700+ zone: Code Name is hidden & locked."
                    : "Set your Code Name (3–20 chars, A–Z / 0–9 / hyphen)."}
                </div>
              </div>

              {!core?.codeHidden && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={codeNameDraft}
                    onChange={(e) => setCodeNameDraft(e.target.value)}
                    placeholder="e.g. Builder-07"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      minWidth: 220,
                    }}
                  />
                  <button
                    type="button"
                    onClick={saveCodeName}
                    disabled={codeNameSaving || codeNameDraft.trim().length === 0}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #111",
                      background: "#111",
                      color: "white",
                      opacity: codeNameSaving || codeNameDraft.trim().length === 0 ? 0.5 : 1,
                      cursor:
                        codeNameSaving || codeNameDraft.trim().length === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    {codeNameSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>

            {codeNameError && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #f1c0c0",
                  background: "#fff7f7",
                }}
              >
                <div style={{ fontWeight: 800 }}>Save failed</div>
                <div style={{ marginTop: 6, opacity: 0.85 }}>{codeNameError}</div>
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
