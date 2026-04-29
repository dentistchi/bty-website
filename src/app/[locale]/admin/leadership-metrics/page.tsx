"use client";

import { useState, useEffect, useCallback } from "react";
import type { LeadershipMetricsResponse, UserAirRow } from "@/app/api/admin/leadership-metrics/route";
import type { StageMetricsResponse, UserStageRow } from "@/app/api/admin/leadership-metrics/stage/route";
import type { MWDMetricsResponse, UserMWDRow } from "@/app/api/admin/leadership-metrics/mwd/route";
import type { TIIMetricsResponse, TeamTIIRow } from "@/app/api/admin/leadership-metrics/tii/route";
import { LoadingFallback } from "@/components/bty-arena";

// ---------------------------------------------------------------------------
// AIR helpers
// ---------------------------------------------------------------------------
function airColor(air: number) {
  if (air >= 0.8) return "text-emerald-700 font-semibold";
  if (air >= 0.5) return "text-amber-700";
  return "text-red-700";
}
function airBadgeColor(air: number) {
  if (air >= 0.8) return "bg-emerald-100 text-emerald-800";
  if (air >= 0.5) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}
function airBadgeLabel(air: number) {
  if (air >= 0.8) return "Certified";
  if (air >= 0.5) return "Active";
  return "At Risk";
}

// ---------------------------------------------------------------------------
// Stage helpers
// ---------------------------------------------------------------------------
const STAGE_COLORS: Record<number, string> = {
  1: "bg-neutral-100 text-neutral-700",
  2: "bg-blue-100 text-blue-800",
  3: "bg-amber-100 text-amber-800",
  4: "bg-emerald-100 text-emerald-800",
};

// ---------------------------------------------------------------------------
// TII helpers
// ---------------------------------------------------------------------------
function tiiColor(tii: number | null) {
  if (tii == null) return "text-neutral-400";
  if (tii >= 0.8) return "text-emerald-700 font-semibold";
  if (tii >= 0.5) return "text-amber-700";
  return "text-red-700";
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------
type Tab = "air" | "stage" | "mwd" | "tii";

const TABS: { key: Tab; label: string; desc: string }[] = [
  { key: "air",   label: "AIR",   desc: "Action Integrity Rate" },
  { key: "stage", label: "Stage", desc: "Leadership Stage" },
  { key: "mwd",   label: "MWD",   desc: "Micro Win Days" },
  { key: "tii",   label: "TII",   desc: "Team Integrity Index" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LeadershipMetricsPage() {
  const [tab, setTab] = useState<Tab>("air");

  const [airData, setAirData] = useState<LeadershipMetricsResponse | null>(null);
  const [stageData, setStageData] = useState<StageMetricsResponse | null>(null);
  const [mwdData, setMwdData] = useState<MWDMetricsResponse | null>(null);
  const [tiiData, setTiiData] = useState<TIIMetricsResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    setError(null);
    try {
      const urlMap: Record<Tab, string> = {
        air:   "/api/admin/leadership-metrics",
        stage: "/api/admin/leadership-metrics/stage",
        mwd:   "/api/admin/leadership-metrics/mwd",
        tii:   "/api/admin/leadership-metrics/tii",
      };
      const res = await fetch(urlMap[t], { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      if (t === "air")   setAirData(data as LeadershipMetricsResponse);
      if (t === "stage") setStageData(data as StageMetricsResponse);
      if (t === "mwd")   setMwdData(data as MWDMetricsResponse);
      if (t === "tii")   setTiiData(data as TIIMetricsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and on tab switch (only if not already loaded)
  useEffect(() => {
    if (tab === "air"   && !airData)   void load("air");
    if (tab === "stage" && !stageData) void load("stage");
    if (tab === "mwd"   && !mwdData)   void load("mwd");
    if (tab === "tii"   && !tiiData)   void load("tii");
  }, [tab, airData, stageData, mwdData, tiiData, load]);

  const refresh = () => {
    if (tab === "air")   setAirData(null);
    if (tab === "stage") setStageData(null);
    if (tab === "mwd")   setMwdData(null);
    if (tab === "tii")   setTiiData(null);
    void load(tab);
  };

  const activeTab = TABS.find((t) => t.key === tab)!;
  const computedAt =
    tab === "air"   ? airData?.computedAt :
    tab === "stage" ? stageData?.computedAt :
    tab === "mwd"   ? mwdData?.computedAt :
    tiiData?.computedAt;

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">리더십 지표</h1>
          <p className="mt-1 text-sm text-neutral-500">{activeTab.desc}</p>
          {computedAt && (
            <p className="mt-0.5 text-xs text-neutral-400">
              계산: {new Date(computedAt).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          새로고침
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-0 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        {TABS.map(({ key, label, desc }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex flex-1 flex-col items-center gap-0.5 px-4 py-3 text-sm transition-colors ${
              tab === key
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            }`}
          >
            <span className="font-semibold">{label}</span>
            <span className={`text-[11px] leading-none ${tab === key ? "text-neutral-300" : "text-neutral-400"}`}>
              {desc}
            </span>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Tab content */}
      {loading ? (
        <LoadingFallback icon="📊" message="데이터 로드 중..." withSkeleton style={{ padding: "32px 20px" }} />
      ) : (
        <>
          {/* AIR tab */}
          {tab === "air" && airData && (
            <AirTable rows={airData.rows} />
          )}

          {/* Stage tab */}
          {tab === "stage" && stageData && (
            <StageView data={stageData} />
          )}

          {/* MWD tab */}
          {tab === "mwd" && mwdData && (
            <MWDTable rows={mwdData.rows} />
          )}

          {/* TII tab */}
          {tab === "tii" && tiiData && (
            <TIITable rows={tiiData.rows} />
          )}

          {/* Empty states */}
          {!loading && !error && tab === "air" && airData?.rows.length === 0 && (
            <EmptyState message="Action Contract 데이터가 없습니다." />
          )}
          {!loading && !error && tab === "stage" && stageData?.rows.length === 0 && (
            <EmptyState message="Leadership Engine State 데이터가 없습니다." />
          )}
          {!loading && !error && tab === "mwd" && mwdData?.rows.length === 0 && (
            <EmptyState message="Micro Win 활성화 데이터가 없습니다." />
          )}
          {!loading && !error && tab === "tii" && tiiData?.rows.length === 0 && (
            <EmptyState message="TII 스냅샷 데이터가 없습니다." />
          )}
        </>
      )}

      {/* Legend */}
      {tab === "air" && !loading && (
        <div className="mt-6 rounded border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500 space-y-1">
          <p><strong>AIR</strong> = 완료된 행동 ÷ 선택된 행동 (draft 제외)</p>
          <p><strong>완료 기준</strong>: approved / completed / DONE, 또는 verified_at 있음</p>
          <p><strong>Integrity Slip</strong>: 3회 연속 미완료 발생 횟수</p>
        </div>
      )}
      {tab === "tii" && !loading && (
        <div className="mt-6 rounded border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500 space-y-1">
          <p><strong>TII</strong> = avg_air × 0.60 + avg_mwd_normalized × 0.25 + tsp_normalized × 0.15</p>
          <p><strong>TSP</strong>: Team Shift Pulse (주간 설문 점수)</p>
        </div>
      )}
      {tab === "mwd" && !loading && (
        <div className="mt-6 rounded border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500 space-y-1">
          <p><strong>MWD</strong>: 최소 1개의 Micro Win 완료가 있는 고유 날짜 수</p>
          <p><strong>7d / 14d</strong>: 최근 7일 / 14일 기준</p>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
      {message}
    </div>
  );
}

function AirTable({ rows }: { rows: UserAirRow[] }) {
  return (
    <div className="overflow-hidden rounded border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50">
          <tr>
            <Th align="left">이메일</Th>
            <Th align="center">상태</Th>
            <Th align="right">AIR</Th>
            <Th align="right">완료 / 선택</Th>
            <Th align="right">미완료</Th>
            <Th align="right">Integrity Slip</Th>
            <Th align="right">마지막 활동</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row) => (
            <tr key={row.userId} className="hover:bg-neutral-50">
              <td className="px-4 py-3 font-mono text-xs text-neutral-900">{row.email}</td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${airBadgeColor(row.air)}`}>
                  {airBadgeLabel(row.air)}
                </span>
              </td>
              <td className={`px-4 py-3 text-right tabular-nums ${airColor(row.air)}`}>
                {row.total === 0 ? "—" : `${(row.air * 100).toFixed(0)}%`}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                {row.completed} / {row.total}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {row.missed > 0 ? <span className="text-red-600">{row.missed}</span> : <span className="text-neutral-400">0</span>}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {row.integritySlips > 0 ? <span className="text-red-700 font-semibold">{row.integritySlips}</span> : <span className="text-neutral-400">—</span>}
              </td>
              <td className="px-4 py-3 text-right text-xs text-neutral-500">
                {row.lastActivity ? new Date(row.lastActivity).toLocaleDateString("ko-KR") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StageView({ data }: { data: StageMetricsResponse }) {
  return (
    <div className="space-y-4">
      {/* Distribution summary */}
      <div className="flex flex-wrap gap-3">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 ${STAGE_COLORS[s]} border-transparent`}>
            <span className="text-xs font-semibold uppercase tracking-wider">Stage {s}</span>
            <span className="text-xl font-bold tabular-nums">{data.distribution[s] ?? 0}</span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <Th align="left">이메일</Th>
              <Th align="center">Stage</Th>
              <Th align="right">Stage 진입</Th>
              <Th align="right">경과일</Th>
              <Th align="center">Forced Reset</Th>
              <Th align="center">Leader Track</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.rows.map((row: UserStageRow) => (
              <tr key={row.userId} className="hover:bg-neutral-50">
                <td className="px-4 py-3 font-mono text-xs text-neutral-900">{row.email}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[row.stage]}`}>
                    Stage {row.stage} · {row.stageLabel}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-neutral-500">
                  {row.stageEnteredAt ? new Date(row.stageEnteredAt).toLocaleDateString("ko-KR") : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                  {row.daysInStage}일
                </td>
                <td className="px-4 py-3 text-center">
                  {row.forcedReset ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">리셋</span>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {row.isLeaderTrack ? (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">Leader</span>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MWDTable({ rows }: { rows: UserMWDRow[] }) {
  return (
    <div className="overflow-hidden rounded border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50">
          <tr>
            <Th align="left">이메일</Th>
            <Th align="right">MWD 7일</Th>
            <Th align="right">MWD 14일</Th>
            <Th align="right">완료 / 전체</Th>
            <Th align="right">완료율</Th>
            <Th align="right">마지막 활동</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row: UserMWDRow) => (
            <tr key={row.userId} className="hover:bg-neutral-50">
              <td className="px-4 py-3 font-mono text-xs text-neutral-900">{row.email}</td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-700 font-semibold">
                {row.mwd7d}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                {row.mwd14d}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                {row.completedActivations} / {row.totalActivations}
              </td>
              <td className={`px-4 py-3 text-right tabular-nums ${
                row.completionRate >= 0.8 ? "text-emerald-700 font-semibold" :
                row.completionRate >= 0.5 ? "text-amber-700" : "text-red-600"
              }`}>
                {row.totalActivations === 0 ? "—" : `${(row.completionRate * 100).toFixed(0)}%`}
              </td>
              <td className="px-4 py-3 text-right text-xs text-neutral-500">
                {row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleDateString("ko-KR") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TIITable({ rows }: { rows: TeamTIIRow[] }) {
  if (rows.length === 0) {
    return <EmptyState message="team_weekly_metrics 스냅샷 데이터가 없습니다." />;
  }
  return (
    <div className="overflow-hidden rounded border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50">
          <tr>
            <Th align="left">리그 / 팀</Th>
            <Th align="right">TII</Th>
            <Th align="right">Avg AIR</Th>
            <Th align="right">Avg MWD</Th>
            <Th align="right">TSP</Th>
            <Th align="right">구성원</Th>
            <Th align="right">기준 주</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row: TeamTIIRow) => (
            <tr key={row.teamId} className="hover:bg-neutral-50">
              <td className="px-4 py-3 text-neutral-900">
                <span className="font-medium">{row.leagueName ?? "—"}</span>
                <span className="ml-1.5 font-mono text-[10px] text-neutral-400">{row.teamId.slice(0, 8)}</span>
              </td>
              <td className={`px-4 py-3 text-right tabular-nums ${tiiColor(row.tii)}`}>
                {row.tii != null ? `${(row.tii * 100).toFixed(0)}%` : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                {row.avgAir != null ? `${(row.avgAir * 100).toFixed(0)}%` : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                {row.avgMwd != null ? row.avgMwd.toFixed(1) : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                {row.tsp != null ? row.tsp.toFixed(2) : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{row.memberCount}</td>
              <td className="px-4 py-3 text-right text-xs text-neutral-500">
                {row.weekStart ? new Date(row.weekStart).toLocaleDateString("ko-KR") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "center" | "right" }) {
  return (
    <th className={`px-4 py-3 text-${align} text-xs font-medium uppercase tracking-wider text-neutral-600`}>
      {children}
    </th>
  );
}
