"use client";

/**
 * Center Healing — 4-step vertical stepper (인정→성찰→재통합→갱신).
 * State: GET /api/bty/healing/phase-tracker; advance: POST (domain `getCurrentPhase` / advance in lib).
 * Reloads when `dear_me_submitted` fires ({@link DEAR_ME_SUBMITTED_EVENT} from Dear Me composer).
 * Render-only for phase labels; completion rules live in @/domain/center/healingPhase + service.
 */

import React from "react";
import Link from "next/link";
import type { HealingJourneyPhaseId } from "@/domain/center/healingPhase";
import { HEALING_JOURNEY_PHASE_IDS } from "@/domain/center/healingPhase";
import { DEAR_ME_SUBMITTED_EVENT } from "@/lib/bty/center/dearMeEvents";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

function phaseActionHref(id: HealingJourneyPhaseId, locale: string): string {
  switch (id) {
    case 1: return `/${locale}/assessment`;
    case 2: return `/${locale}/dear-me`;
    case 3:
    case 4: return `/${locale}/bty/healing`;
    default: return `/${locale}/center`;
  }
}

function phaseActionLabel(id: HealingJourneyPhaseId, isKo: boolean): string {
  switch (id) {
    case 1: return isKo ? "진단하기 →" : "Take assessment →";
    case 2: return isKo ? "편지 쓰기 →" : "Write a letter →";
    case 3:
    case 4: return isKo ? "Awakening 기록하기 →" : "Log awakening act →";
    default: return "";
  }
}

export const HEALING_PHASE_ADVANCED_EVENT = "phase_advanced" as const;

export type HealingPhaseAdvancedDetail = {
  previousPhase: HealingJourneyPhaseId;
  newPhase: HealingJourneyPhaseId;
  userId?: string;
};

type PhaseTrackerApi = {
  ok?: boolean;
  activePhase?: HealingJourneyPhaseId;
  canAdvance?: boolean;
  phaseComplete?: Record<string, boolean>;
  inputsSummary?: {
    assessmentCount: number;
    dearMeLetterCount: number;
    awakeningActsCompleted: number;
  };
  error?: string;
};

function dispatchPhaseAdvanced(detail: HealingPhaseAdvancedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HEALING_PHASE_ADVANCED_EVENT, { detail }));
}

function stepTitle(t: ReturnType<typeof getMessages>["healing"], id: HealingJourneyPhaseId): string {
  switch (id) {
    case 1:
      return t.healingPhaseStep1;
    case 2:
      return t.healingPhaseStep2;
    case 3:
      return t.healingPhaseStep3;
    case 4:
      return t.healingPhaseStep4;
    default:
      return "";
  }
}

function stepPrompt(t: ReturnType<typeof getMessages>["healing"], id: HealingJourneyPhaseId): string {
  switch (id) {
    case 1:
      return t.healingPhasePrompt1;
    case 2:
      return t.healingPhasePrompt2;
    case 3:
      return t.healingPhasePrompt3;
    case 4:
      return t.healingPhasePrompt4;
    default:
      return "";
  }
}

export type HealingPhaseTrackerProps = {
  locale: Locale | string;
  /** Optional; included in `phase_advanced` detail when provided. */
  userId?: string;
};

export function HealingPhaseTracker({ locale, userId }: HealingPhaseTrackerProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = getMessages(loc).healing;

  const [data, setData] = React.useState<PhaseTrackerApi | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [advancing, setAdvancing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/bty/healing/phase-tracker", { credentials: "include" });
      const json = (await r.json().catch(() => ({}))) as PhaseTrackerApi;
      if (!r.ok) {
        setError((json as { error?: string }).error ?? t.healingPhaseTrackerLoadError);
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError(t.healingPhaseTrackerLoadError);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [t.healingPhaseTrackerLoadError]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onDearMe = () => {
      void load();
    };
    window.addEventListener(DEAR_ME_SUBMITTED_EVENT, onDearMe);
    return () => window.removeEventListener(DEAR_ME_SUBMITTED_EVENT, onDearMe);
  }, [load]);

  const advance = async () => {
    setAdvancing(true);
    setError(null);
    try {
      const r = await fetch("/api/bty/healing/phase-tracker", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        previousPhase?: HealingJourneyPhaseId;
        newPhase?: HealingJourneyPhaseId;
        error?: string;
      };
      if (!r.ok || !json.ok) {
        setError(json.error ?? t.healingPhaseAdvanceError);
        return;
      }
      if (json.previousPhase != null && json.newPhase != null) {
        dispatchPhaseAdvanced({
          previousPhase: json.previousPhase,
          newPhase: json.newPhase,
          userId,
        });
      }
      await load();
    } catch {
      setError(t.healingPhaseAdvanceError);
    } finally {
      setAdvancing(false);
    }
  };

  if (loading && !data) {
    return (
      <section role="status" aria-busy="true" aria-label={t.loading}>
        <p style={{ margin: "0 0 8px", fontWeight: 600 }}>{t.healingPhaseTrackerTitle}</p>
        <p style={{ margin: 0, color: "#64748b" }}>{t.loading}</p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section role="alert" aria-label={t.healingPhaseTrackerRegionAria}>
        <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p>
      </section>
    );
  }

  const activePhase = (data?.activePhase ?? 1) as HealingJourneyPhaseId;
  const canAdvance = Boolean(data?.canAdvance);
  const phaseComplete = data?.phaseComplete ?? {};
  const sum = data?.inputsSummary;

  const inputsHint =
    sum != null
      ? t.healingPhaseInputsHint
          .replace(/\{a\}/g, String(sum.assessmentCount))
          .replace(/\{l\}/g, String(sum.dearMeLetterCount))
          .replace(/\{aw\}/g, String(sum.awakeningActsCompleted))
      : null;

  return (
    <section
      role="region"
      aria-label={t.healingPhaseTrackerRegionAria}
      style={{
        maxWidth: 480,
        padding: "16px",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#fff",
      }}
    >
      <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>{t.healingPhaseTrackerTitle}</h2>

      {inputsHint ? (
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#64748b" }}>{inputsHint}</p>
      ) : null}

      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {HEALING_JOURNEY_PHASE_IDS.map((id, idx) => {
          const isActive = id === activePhase;
          const done = Boolean(phaseComplete[String(id)]);
          const title = stepTitle(t, id);
          const prompt = stepPrompt(t, id);
          const isLast = idx === HEALING_JOURNEY_PHASE_IDS.length - 1;

          return (
            <li
              key={id}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr",
                columnGap: 12,
                position: "relative",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span
                  aria-current={isActive ? "step" : undefined}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                    border: `2px solid ${done ? "#16a34a" : isActive ? "#2563eb" : "#cbd5e1"}`,
                    background: done ? "#f0fdf4" : isActive ? "#eff6ff" : "#f8fafc",
                    color: done ? "#15803d" : isActive ? "#1d4ed8" : "#64748b",
                  }}
                >
                  {id}
                </span>
                {!isLast ? (
                  <span
                    aria-hidden
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 24,
                      background: done ? "#86efac" : "#e2e8f0",
                      marginTop: 4,
                    }}
                  />
                ) : null}
              </div>
              <div style={{ paddingBottom: isLast ? 0 : 20 }}>
                <p
                  style={{
                    margin: "0 0 6px",
                    fontWeight: isActive ? 700 : 600,
                    color: isActive ? "#0f172a" : "#334155",
                  }}
                >
                  {title}
                </p>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#475569" }}>{prompt}</p>
                {done ? (
                  <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>✓</span>
                ) : null}
                {isActive && !done ? (
                  <div style={{ marginTop: 8 }}>
                    <Link
                      href={phaseActionHref(id, loc)}
                      style={{
                        display: "inline-block",
                        padding: "5px 12px",
                        borderRadius: 8,
                        border: "1px solid #3b82f6",
                        color: "#2563eb",
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      {phaseActionLabel(id, loc === "ko")}
                    </Link>
                  </div>
                ) : done && id >= 3 ? (
                  <div style={{ marginTop: 6 }}>
                    <Link
                      href={phaseActionHref(id, loc)}
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        borderRadius: 8,
                        border: "1px solid #94a3b8",
                        color: "#64748b",
                        fontSize: 12,
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                    >
                      Healing Hub →
                    </Link>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {error && data ? <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 12 }}>{error}</p> : null}

      {canAdvance ? (
        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            className="rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={advancing}
            onClick={() => void advance()}
          >
            {advancing ? t.healingPhaseAdvancing : t.healingPhaseAdvanceCta}
          </button>
        </div>
      ) : null}

      {Boolean(phaseComplete["4"]) && !canAdvance ? (
        <div
          style={{
            marginTop: 20,
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid #86efac",
            background: "#f0fdf4",
          }}
          role="status"
          aria-live="polite"
        >
          <p style={{ fontWeight: 600, color: "#15803d", margin: "0 0 6px", fontSize: 14 }}>
            {loc === "ko" ? "치유 여정 완료" : "Healing journey complete"}
          </p>
          <p style={{ fontSize: 13, color: "#166534", margin: "0 0 12px" }}>
            {loc === "ko"
              ? "모든 단계를 마쳤습니다. Arena로 돌아가실 수 있어요."
              : "All phases complete. You can return to Arena."}
          </p>
          <Link
            href={`/${loc}/bty-arena`}
            style={{
              display: "inline-block",
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid #16a34a",
              color: "#15803d",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {loc === "ko" ? "Arena로 돌아가기" : "Return to Arena"}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
