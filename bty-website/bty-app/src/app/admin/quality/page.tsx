"use client";

import { useState, useEffect, useCallback } from "react";
import type { Summary, Trend, PatchReport } from "@/components/admin/types";
import { AdminKpiCards } from "@/components/admin/AdminKpiCards";
import { TopPatternsCard } from "@/components/admin/TopPatternsCard";
import { IssueFrequencyCard } from "@/components/admin/IssueFrequencyCard";
import { PatchReportsCard } from "@/components/admin/PatchReportsCard";
import { EmptyStateGuide } from "@/components/admin/EmptyStateGuide";

export default function AdminQualityPage() {
  const [windowDays, setWindowDays] = useState<7 | 30>(7);
  const [routeFilter, setRouteFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [patches, setPatches] = useState<PatchReport[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [loadingPatches, setLoadingPatches] = useState(true);
  const [insertingSample, setInsertingSample] = useState(false);
  const [insertResult, setInsertResult] = useState<{ inserted?: number; error?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<{
    db_ok: boolean;
    total_events_30d: number;
    latest_event_at: string | null;
    error?: string;
  } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const windowParam = `${windowDays}d`;
  const canInsertSample = process.env.NODE_ENV === "development";

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set("window", windowParam);
    if (routeFilter !== "all") params.set("route", routeFilter);
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (severityFilter !== "all") params.set("severity", severityFilter);
    return params.toString();
  }, [windowParam, routeFilter, roleFilter, severityFilter]);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError(null);
    try {
      const qs = buildQuery();
      const res = await fetch(`/api/admin/quality/summary?${qs}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setSummary(data);
        setLastUpdated(new Date());
      } else {
        setSummary(null);
        setError(data.error || "Failed to load");
      }
    } catch (e: unknown) {
      setSummary(null);
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoadingSummary(false);
    }
  }, [buildQuery]);

  const fetchSummarySilent = useCallback(async () => {
    try {
      const qs = buildQuery();
      const res = await fetch(`/api/admin/quality/summary?${qs}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setSummary(data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError(data.error || "Failed to load");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Network error");
    }
  }, [buildQuery]);

  const fetchTrends = useCallback(async () => {
    setLoadingTrends(true);
    try {
      const res = await fetch(
        `/api/admin/quality/trends?window=14d&top=10`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (res.ok) setTrends(data.trends || []);
      else setTrends([]);
    } catch {
      setTrends([]);
    } finally {
      setLoadingTrends(false);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/quality/health`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setHealth(data);
      } else {
        setHealth({ db_ok: false, total_events_30d: 0, latest_event_at: null, error: data.error });
      }
    } catch (e) {
      setHealth({
        db_ok: false,
        total_events_30d: 0,
        latest_event_at: null,
        error: e instanceof Error ? e.message : "Network error",
      });
    }
  }, []);

  const fetchPatches = useCallback(async () => {
    setLoadingPatches(true);
    try {
      const res = await fetch(`/api/admin/patch/recent?limit=3`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) setPatches(data.reports || []);
      else setPatches([]);
    } catch {
      setPatches([]);
    } finally {
      setLoadingPatches(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    fetchTrends();
    fetchPatches();
  }, [fetchTrends, fetchPatches]);

  // Poll summary/top/frequencies every 5s, pause when tab hidden
  useEffect(() => {
    if (typeof document === "undefined") return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const schedulePoll = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (document.visibilityState === "visible") {
        timer = setInterval(fetchSummarySilent, 5_000);
      }
    };

    schedulePoll();
    document.addEventListener("visibilitychange", schedulePoll);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", schedulePoll);
    };
  }, [fetchSummarySilent]);

  const handleInsertSample = useCallback(async () => {
    if (!canInsertSample) return;
    setInsertingSample(true);
    setInsertResult(null);
    try {
      const res = await fetch(`/api/admin/quality/seed`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        const n = data.inserted ?? 0;
        setInsertResult({ inserted: n });
        if (n > 0) {
          fetchSummary();
          fetchTrends();
          fetchHealth();
        }
      } else {
        setInsertResult({ error: data.error || `HTTP ${res.status}` });
      }
    } catch (e) {
      setInsertResult({ error: e instanceof Error ? e.message : "Network error" });
    } finally {
      setInsertingSample(false);
    }
  }, [canInsertSample, fetchSummary, fetchTrends, fetchHealth]);

  const isEmpty = !loadingSummary && summary && summary.total_events === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-600">
        원문 대화는 저장/표시하지 않음(시그니처/집계만).
      </p>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Health indicators */}
      {health && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm">
          <span>
            DB:{" "}
            <strong className={health.db_ok ? "text-emerald-600" : "text-red-600"}>
              {health.db_ok ? "OK" : "FAIL"}
            </strong>
          </span>
          <span>
            total_events_30d: <strong>{health.total_events_30d}</strong>
          </span>
          <span>
            latest_event_at:{" "}
            <strong>
              {health.latest_event_at
                ? new Date(health.latest_event_at).toLocaleString()
                : "—"}
            </strong>
          </span>
          {!health.db_ok && health.error && canInsertSample && (
            <span className="text-red-600">({health.error})</span>
          )}
        </div>
      )}

      {/* Filters row */}
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold text-neutral-800">
          What should I fix this week?
        </h1>
        {lastUpdated && (
          <span className="text-sm text-neutral-500">
            Last updated: {lastUpdated.toLocaleTimeString("ko-KR", { hour12: false })}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value) as 7 | 30)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium"
          >
            <option value={7}>7d</option>
            <option value={30}>30d</option>
          </select>
          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">route: all</option>
            <option value="web">web</option>
            <option value="teams">teams</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">role: all</option>
            {(summary?.breakdown?.role ?? []).slice(0, 5).map((r) => (
              <option key={r.value} value={r.value}>
                {r.value}
              </option>
            ))}
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">severity: all</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </div>
      </div>

      {/* Quick search */}
      <div className="mb-6">
        <input
          type="search"
          placeholder="Search signatures by issue name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md rounded-lg border border-neutral-300 px-4 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
      </div>

      {isEmpty ? (
        <EmptyStateGuide
          onInsertSample={handleInsertSample}
          canInsertSample={canInsertSample}
          insertingSample={insertingSample}
          insertResult={insertResult}
        />
      ) : (
        <>
          {/* KPI row */}
          <div className="mb-8">
            <AdminKpiCards summary={summary} loading={loadingSummary} />
          </div>

          {/* Main content grid */}
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TopPatternsCard
                summary={summary}
                trends={trends}
                loadingSummary={loadingSummary}
                loadingTrends={loadingTrends}
                windowParam={windowParam}
                searchQuery={searchQuery || undefined}
                onRefresh={() => {
                  fetchSummary();
                  fetchPatches();
                }}
              />
            </div>
            <div className="space-y-6">
              <IssueFrequencyCard
                summary={summary}
                loading={loadingSummary}
                searchQuery={searchQuery || undefined}
              />
              <PatchReportsCard
                patches={patches}
                loading={loadingPatches}
                onRefresh={fetchPatches}
              />
            </div>
          </div>
        </>
      )}

      {canInsertSample && !isEmpty && (
        <div className="mt-8">
          <button
            onClick={handleInsertSample}
            disabled={insertingSample}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            {insertingSample ? "Inserting…" : "Insert Sample Events (dev only)"}
          </button>
          {insertResult?.inserted !== undefined && (
            <span className="ml-3 text-sm text-emerald-600">
              Inserted {insertResult.inserted} events
            </span>
          )}
          {insertResult?.error && (
            <span className="ml-3 text-sm text-red-600">
              Error: {insertResult.error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
