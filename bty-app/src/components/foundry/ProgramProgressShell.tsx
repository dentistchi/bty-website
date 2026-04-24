"use client";

/**
 * Foundry — program progress: GET `/api/bty/foundry/program-shell`, module checklist → POST `set_pct`,
 * Realtime `user_program_progress`, completion overlay + `foundry_exit_ready`, optional Dojo CTA.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import React from "react";
import { postFoundryProgramProgress } from "@/components/foundry/ProgramRecommenderWidget";
import type { DojoSkillArea } from "@/engine/foundry/dojo-assessment.service";
import { FOUNDRY_EXIT_READY_EVENT, type FoundryExitReadyDetail } from "@/lib/bty/foundry/foundryExitEvents";
import { getSupabase } from "@/lib/supabase";
import { useArenaEntryResolution } from "@/lib/bty/arena/useArenaEntryResolution";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type ShellCatalog = {
  title: string;
  phase_tags: string[];
  modules: string[];
  skill_area: DojoSkillArea | null;
};

type ShellProgress = {
  user_id: string;
  program_id: string;
  started_at: string;
  completed_at: string | null;
  completion_pct: number;
};

type ShellJson = {
  ok: true;
  userId: string;
  progress: ShellProgress;
  catalog: ShellCatalog;
  weakest_skill_area: DojoSkillArea;
  pending_dojo_assessment_task_id: string | null;
  show_dojo_assessment_cta: boolean;
};

function completedModuleCount(pct: number, m: number): number {
  if (m <= 0 || pct <= 0) return 0;
  if (pct >= 100) return m;
  const step = 100 / m;
  return Math.min(m, Math.ceil(pct / step - 1e-9));
}

function dispatchFoundryExitReady(detail: FoundryExitReadyDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FOUNDRY_EXIT_READY_EVENT, { detail }));
}

export type ProgramProgressShellProps = {
  locale: Locale | string;
  routeLocale: string;
  programId: string;
};

export function ProgramProgressShell({ locale, routeLocale, programId }: ProgramProgressShellProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const b = getMessages(loc).bty;
  const entryLoc = routeLocale === "ko" ? "ko" : "en";
  const { contract: arenaEntry } = useArenaEntryResolution(entryLoc);

  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [shell, setShell] = React.useState<ShellJson | null>(null);
  const [pct, setPct] = React.useState(0);
  const [updating, setUpdating] = React.useState(false);
  const [updateErr, setUpdateErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoadErr(null);
    try {
      const q = new URLSearchParams({ programId, lang: loc });
      const r = await fetch(`/api/bty/foundry/program-shell?${q.toString()}`, { credentials: "include" });
      const j = (await r.json().catch(() => ({}))) as ShellJson & { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setLoadErr(typeof j.error === "string" ? j.error : b.programProgressShellError);
        return;
      }
      setShell(j);
      setPct(j.progress.completion_pct);
    } catch {
      setLoadErr(b.programProgressShellError);
    }
  }, [programId, loc, b.programProgressShellError]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const userId = shell?.userId ?? null;

  React.useEffect(() => {
    if (!userId || !programId) return;
    const sb = getSupabase();
    const channel = sb
      .channel(`user_program_progress:${userId}:${programId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_program_progress",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { program_id?: string; completion_pct?: number } | null;
          if (!row || row.program_id !== programId) return;
          if (typeof row.completion_pct === "number") {
            setPct(Math.min(100, Math.max(0, row.completion_pct)));
          }
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [userId, programId]);

  const modules = shell?.catalog.modules ?? [];
  const m = modules.length;
  const completed = completedModuleCount(pct, m);
  const showCompleteOverlay = pct >= 100;

  const onModuleTap = async (index: number) => {
    if (!shell || m <= 0 || pct >= 100 || updating) return;
    if (index !== completed) return;
    const newPct = index === m - 1 ? 100 : Math.round(((index + 1) / m) * 100);
    setUpdating(true);
    setUpdateErr(null);
    try {
      const r = await postFoundryProgramProgress({
        action: "set_pct",
        programId,
        completionPct: newPct,
      });
      if (!r.ok) {
        setUpdateErr(r.error ?? "update_failed");
        return;
      }
      setPct(newPct);
      await load();
    } catch {
      setUpdateErr("update_failed");
    } finally {
      setUpdating(false);
    }
  };

  const phaseTag = shell?.catalog.phase_tags?.[0] ?? "—";
  const title = shell?.catalog.title ?? programId;
  const arenaHref = arenaEntry.href;
  const dojoHref =
    shell?.catalog.skill_area != null
      ? `/${routeLocale}/bty/foundry/dojo-micro?skill_area=${encodeURIComponent(shell.catalog.skill_area)}`
      : `/${routeLocale}/bty/foundry/dojo-micro`;

  if (!shell && !loadErr) {
    return (
      <section role="status" aria-busy="true" aria-label={b.programProgressShellLoading}>
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>{b.programProgressShellLoading}</p>
      </section>
    );
  }

  if (loadErr || !shell) {
    return (
      <section role="alert" aria-label={b.programProgressShellRegionAria}>
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{loadErr ?? b.programProgressShellError}</p>
      </section>
    );
  }

  return (
    <section role="region" aria-label={b.programProgressShellRegionAria}>
      <div
        style={{
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          background: "var(--arena-card, #fff)",
          padding: "18px 18px 20px",
          maxWidth: 560,
        }}
      >
        <header style={{ marginBottom: 14 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{title}</h2>
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#64748b" }}>
            {b.programProgressShellPhaseLabel}: <span style={{ color: "#0f766e" }}>{phaseTag}</span>
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>{b.programProgressShellCompletionLabel}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{Math.round(pct)}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{
              height: 10,
              borderRadius: 999,
              background: "#e2e8f0",
              overflow: "hidden",
            }}
          >
            <motion.div
              initial={false}
              animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              style={{ height: "100%", background: "#0d9488", borderRadius: 999 }}
            />
          </div>
        </header>

        <h3 style={{ margin: "16px 0 10px", fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
          {b.programProgressShellModulesHeading}
        </h3>
        <p style={{ margin: "0 0 8px", fontSize: 11, color: "#94a3b8" }}>{b.programProgressShellModuleTap}</p>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {modules.map((label, i) => {
            const done = i < completed;
            const next = i === completed && pct < 100;
            return (
              <li key={`${i}-${label}`}>
                <button
                  type="button"
                  disabled={!next || updating}
                  onClick={() => void onModuleTap(i)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${done ? "rgba(13,148,136,0.35)" : next ? "#0d9488" : "#e2e8f0"}`,
                    background: done ? "rgba(13,148,136,0.06)" : next ? "rgba(13,148,136,0.1)" : "#f8fafc",
                    cursor: next && !updating ? "pointer" : "default",
                    fontSize: 14,
                    color: "#0f172a",
                  }}
                >
                  <span style={{ marginRight: 8, color: done ? "#0d9488" : "#94a3b8" }}>{done ? "✓" : "○"}</span>
                  {label}
                </button>
              </li>
            );
          })}
        </ul>

        {updateErr ? (
          <p role="alert" style={{ margin: "12px 0 0", color: "#b91c1c", fontSize: 13 }}>
            {updateErr}
          </p>
        ) : null}

        {shell.show_dojo_assessment_cta ? (
          <div style={{ marginTop: 16 }}>
            <Link
              href={dojoHref}
              style={{
                display: "inline-block",
                fontSize: 14,
                fontWeight: 800,
                padding: "10px 16px",
                borderRadius: 10,
                background: "#0f766e",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              {b.programProgressShellDojoCta}
            </Link>
          </div>
        ) : null}
      </div>

      {showCompleteOverlay ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="program-complete-heading"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(15, 23, 42, 0.45)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              borderRadius: 16,
              background: "#fff",
              padding: "24px 22px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
              textAlign: "center",
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              style={{ marginBottom: 12 }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 13l4 4L19 7"
                  stroke="#0d9488"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
            <h2 id="program-complete-heading" style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              {b.programProgressShellCompleteOverlay}
            </h2>
            <Link
              href={arenaHref}
              onClick={() =>
                dispatchFoundryExitReady({ programId, userId: shell.userId })
              }
              style={{
                display: "inline-block",
                fontSize: 15,
                fontWeight: 800,
                padding: "12px 20px",
                borderRadius: 10,
                background: "#0d9488",
                color: "#fff",
                textDecoration: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {b.programProgressShellArenaCta}
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
