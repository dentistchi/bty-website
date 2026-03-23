"use client";

/**
 * Arena — Top 20 weekly XP from GET /api/arena/leaderboard (weekly order only; Core XP display-only).
 * Countdown: `reset_at` = next Monday 00:00 UTC (API `getLeaderboardWeekBoundary`).
 * Live refresh: Supabase Realtime `weekly_xp` changes + broadcast event `leaderboard_updated`.
 */

import React from "react";
import { LeaderboardRow } from "@/components/bty-arena";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { getSupabase } from "@/lib/supabase";
import { getMessages, arenaStableLabel } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { leaderboardTieRankSuffixDisplayKey } from "@/domain/rules/leaderboardTieBreak";
import type { LeaderboardRow as LeaderboardRowData } from "@/lib/bty/arena/leaderboardService";

export const LEADERBOARD_UPDATED_EVENT = "leaderboard_updated" as const;

const TOP_N = 20;
const REFETCH_DEBOUNCE_MS = 400;

type LeaderboardApi = {
  leaderboard?: LeaderboardRowData[];
  reset_at?: string | null;
  error?: string;
  message?: string;
};

function formatCountdown(ms: number, loc: "ko" | "en"): string {
  if (ms <= 0) return loc === "ko" ? "곧 초기화" : "Resetting soon";
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export type LeaderboardWidgetProps = {
  locale: Locale | string;
  /** Passed to leaderboard API (default overall). */
  scope?: "overall" | "role" | "office";
};

export function LeaderboardWidget({ locale, scope = "overall" }: LeaderboardWidgetProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = getMessages(loc).bty;

  const [rows, setRows] = React.useState<LeaderboardRowData[]>([]);
  const [resetAt, setResetAt] = React.useState<string | null>(null);
  const [myUserId, setMyUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const q = `/api/arena/leaderboard?scope=${encodeURIComponent(scope)}`;
      const data = await arenaFetch<LeaderboardApi>(q);
      const lb = Array.isArray(data.leaderboard) ? data.leaderboard : [];
      setRows(lb.slice(0, TOP_N));
      setResetAt(data.reset_at ?? null);
    } catch {
      setError(t.leaderboardWidgetError);
      setRows([]);
      setResetAt(null);
    } finally {
      setLoading(false);
    }
  }, [scope, t.leaderboardWidgetError]);

  const scheduleLoad = React.useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void load();
    }, REFETCH_DEBOUNCE_MS);
  }, [load]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/arena/profile", { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { profile?: { user_id?: string } };
        if (!alive) return;
        const uid = typeof j.profile?.user_id === "string" ? j.profile.user_id : null;
        setMyUserId(uid);
      })
      .catch(() => {
        if (alive) setMyUserId(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    let client: ReturnType<typeof getSupabase> | null = null;
    try {
      client = getSupabase();
    } catch {
      return;
    }

    const channel = client
      .channel("leaderboard_updated")
      .on("broadcast", { event: LEADERBOARD_UPDATED_EVENT }, () => {
        scheduleLoad();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weekly_xp" },
        () => {
          scheduleLoad();
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      client?.removeChannel(channel);
    };
  }, [scheduleLoad]);

  const countdownLabel = React.useMemo(() => {
    if (!resetAt) return null;
    const target = new Date(resetAt).getTime();
    const ms = target - Date.now();
    return formatCountdown(ms, loc);
  }, [resetAt, loc, tick]);

  if (loading && rows.length === 0) {
    return (
      <section role="status" aria-busy="true" aria-label={t.leaderboardWidgetLoading}>
        <p style={{ margin: 0, fontWeight: 600 }}>{t.leaderboardWidgetTitle}</p>
        <p style={{ margin: "8px 0 0", color: "#64748b" }}>{t.leaderboardWidgetLoading}</p>
      </section>
    );
  }

  if (error) {
    return (
      <section role="alert" aria-label={t.leaderboardWidgetRegionAria}>
        <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p>
      </section>
    );
  }

  return (
    <section
      role="region"
      aria-label={t.leaderboardWidgetRegionAria}
      style={{
        padding: 16,
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "var(--arena-card, #fff)",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t.leaderboardWidgetTitle}</h2>
        {countdownLabel ? (
          <p style={{ margin: 0, fontSize: 13, color: "#475569", fontVariantNumeric: "tabular-nums" }}>
            {t.leaderboardWidgetResetCountdown}: {countdownLabel}
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p style={{ margin: 0, color: "#64748b" }}>{t.leaderboardWidgetEmpty}</p>
      ) : (
        <div role="list" aria-label={t.leaderboardWidgetTop20Aria} style={{ display: "grid", gap: 10 }}>
          {rows.map((r, i) => {
            const tieKey = leaderboardTieRankSuffixDisplayKey(i > 0 && r.xpTotal === rows[i - 1]!.xpTotal);
            const tieSuffix =
              tieKey != null ? arenaStableLabel(loc, "arena.leaderboard.tieRankSuffix") : null;
            const isMe = myUserId != null && r.userId === myUserId;
            return (
              <LeaderboardRow
                key={r.userId}
                rank={r.rank}
                codeName={r.codeName}
                subName={r.subName}
                weeklyXp={r.xpTotal}
                coreXpTotal={r.coreXpTotal}
                avatarUrl={r.avatarUrl}
                avatarLayers={r.avatarLayers}
                tier={r.tier}
                isMe={isMe}
                locale={loc}
                tieRankSuffix={tieSuffix}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
