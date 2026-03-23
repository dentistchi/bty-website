"use client";

import React from "react";
import Link from "next/link";
import {
  ARENA_ACCESS_RESTORED_EVENT,
  type ArenaAccessRestoredPayload,
} from "@/engine/forced-reset/center-return.flow";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type ForcedResetUxState = {
  lockout_start: string | null;
  locked: boolean;
  current_stage: number;
  reset_due_at: string | null;
};

const CHECKLIST_IDS = ["stabilize", "boundary", "accountability"] as const;

function formatHms(totalMs: number): string {
  if (totalMs <= 0) return "0:00:00";
  const s = Math.floor(totalMs / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] !== undefined ? String(vars[k]) : "",
  );
}

export type ForcedResetUXProps = {
  locale: Locale | string;
  /** Arena 진입 링크 (잠금 시 비활성) */
  arenaHref: string;
};

/**
 * 무결성 리셋(Stage 4) — 48h 카운트다운, Arena 네비 차단, Center 진단 체크리스트, 복귀 신청.
 * 상태: `GET /api/center/forced-reset/ux-state` · 복귀: `POST /api/center/forced-reset/return-request`.
 */
export function ForcedResetUX({ locale, arenaHref }: ForcedResetUXProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const c = getMessages(loc).center;

  const [ux, setUx] = React.useState<ForcedResetUxState | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [checklist, setChecklist] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(CHECKLIST_IDS.map((id) => [id, false])),
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/center/forced-reset/ux-state", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<ForcedResetUxState>;
      })
      .then((data) => {
        if (!cancelled) setUx(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(c.forcedResetError);
      });
    return () => {
      cancelled = true;
    };
  }, [c.forcedResetError]);

  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const resetDueMs = ux?.reset_due_at ? new Date(ux.reset_due_at).getTime() : null;
  const remainingMs =
    resetDueMs != null && ux?.locked ? Math.max(0, resetDueMs - now) : 0;

  const doneCount = CHECKLIST_IDS.filter((id) => checklist[id]).length;
  const allDone = doneCount === CHECKLIST_IDS.length;

  const labelFor = (id: (typeof CHECKLIST_IDS)[number]) => {
    switch (id) {
      case "stabilize":
        return c.forcedResetItemStabilize;
      case "boundary":
        return c.forcedResetItemBoundary;
      case "accountability":
        return c.forcedResetItemAccountability;
      default:
        return id;
    }
  };

  async function submitReturn() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/center/forced-reset/return-request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allRequiredDiagnosticsPassed: true }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        arena_access_restored?: ArenaAccessRestoredPayload;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.arena_access_restored) {
        setSubmitError(c.forcedResetError);
        return;
      }
      const detail: ArenaAccessRestoredPayload = data.arena_access_restored;
      window.dispatchEvent(new CustomEvent(ARENA_ACCESS_RESTORED_EVENT, { detail }));
      const refreshed = await fetch("/api/center/forced-reset/ux-state", { credentials: "include" });
      if (refreshed.ok) {
        setUx((await refreshed.json()) as ForcedResetUxState);
      }
    } catch {
      setSubmitError(c.forcedResetError);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <p role="alert" style={{ fontSize: 14, color: "#8b2e2e" }}>
        {loadError}
      </p>
    );
  }

  if (ux == null) {
    return (
      <p style={{ fontSize: 14, opacity: 0.8 }} aria-busy="true">
        {c.loading}
      </p>
    );
  }

  if (ux.current_stage !== 4) {
    return null;
  }

  return (
    <section
      role="region"
      aria-label={c.forcedResetRegionAria}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 18,
        borderRadius: 16,
        border: "1px solid #e8e3d8",
        background: "var(--arena-card, #faf8f5)",
        maxWidth: 480,
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          background: ux.locked ? "rgba(139, 46, 46, 0.08)" : "rgba(64, 90, 116, 0.08)",
          border: `1px solid ${ux.locked ? "#e8c5c5" : "#d7cfbf"}`,
        }}
      >
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--arena-text, #1e2a38)" }}>
          {c.forcedResetBannerTitle}
        </p>
        {ux.locked && resetDueMs != null ? (
          <div style={{ marginTop: 10 }} aria-live="polite">
            <p style={{ margin: "0 0 4px", fontSize: 12, opacity: 0.85 }}>{c.forcedResetCountdownLive}</p>
            <p
              style={{ margin: 0, fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
              aria-label={`${c.forcedResetCountdownLive}: ${formatHms(remainingMs)}`}
            >
              {formatHms(remainingMs)}
            </p>
          </div>
        ) : (
          <p style={{ margin: "10px 0 0", fontSize: 13, opacity: 0.9 }}>{c.forcedResetWindowElapsed}</p>
        )}
      </div>

      <div>
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>{c.forcedResetArenaNavLabel}</p>
        {ux.locked ? (
          <span
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 10,
              opacity: 0.5,
              cursor: "not-allowed",
              border: "1px solid #ccc",
            }}
            aria-disabled="true"
            title={c.forcedResetArenaBlockedHint}
          >
            {c.forcedResetArenaNavLabel}
          </span>
        ) : (
          <Link
            href={arenaHref}
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #405a74",
              color: "#1e2a38",
              fontWeight: 600,
            }}
          >
            {c.forcedResetArenaNavLabel}
          </Link>
        )}
        {ux.locked ? (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#8b2e2e" }}>{c.forcedResetArenaBlockedHint}</p>
        ) : null}
      </div>

      <div role="group" aria-label={c.forcedResetChecklistTitle}>
        <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700 }}>{c.forcedResetChecklistTitle}</p>
        <p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.85 }}>
          {interpolate(c.forcedResetProgress, { done: doneCount, total: CHECKLIST_IDS.length })}
        </p>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
          {CHECKLIST_IDS.map((id) => (
            <li key={id} style={{ marginBottom: 8 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={checklist[id]}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, [id]: e.target.checked }))}
                />
                <span style={{ fontSize: 14, lineHeight: 1.45 }}>{labelFor(id)}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {submitError ? (
        <p role="alert" style={{ margin: 0, fontSize: 13, color: "#8b2e2e" }}>
          {submitError}
        </p>
      ) : null}

      {allDone ? (
        <button
          type="button"
          onClick={() => void submitReturn()}
          disabled={submitting}
          style={{
            padding: "12px 18px",
            borderRadius: 12,
            border: "none",
            fontWeight: 700,
            fontSize: 15,
            cursor: submitting ? "wait" : "pointer",
            background: "var(--arena-accent, #405a74)",
            color: "#fff",
          }}
        >
          {submitting ? c.forcedResetSubmitting : c.forcedResetReturnCta}
        </button>
      ) : null}
    </section>
  );
}
