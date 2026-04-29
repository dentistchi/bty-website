"use client";

/**
 * Post-session overlay: locale-aware title, choice, flag badge, Core/Weekly XP from {@link validateXPAward},
 * AIR execution-integrity **bands** (no raw score), optional session note, Pattern Shift placeholder,
 * optional {@link getPatternNarrative} line when XP gate fired, CTAs.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { airToBand, type AIRBand } from "@/domain/leadership-engine/air";
import type { SessionFlagBadgeVariant } from "@/domain/arena/sessionSummary";
import type { XPAwardResult } from "@/engine/integration/xp-integrity-bridge";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export const NEXT_SCENARIO_REQUESTED_EVENT = "next_scenario_requested" as const;

function badgeLabel(variant: SessionFlagBadgeVariant, locale: "ko" | "en"): string {
  if (locale === "ko") {
    if (variant === "hero_trap") return "히어로 트랩";
    if (variant === "integrity_slip") return "무결성 이탈";
    return "클린";
  }
  if (variant === "hero_trap") return "Hero Trap";
  if (variant === "integrity_slip") return "Integrity Slip";
  return "Clean";
}

function badgeStyles(variant: SessionFlagBadgeVariant): React.CSSProperties {
  if (variant === "hero_trap") {
    return { background: "rgba(180, 83, 9, 0.15)", color: "#92400e", border: "1px solid rgba(180, 83, 9, 0.35)" };
  }
  if (variant === "integrity_slip") {
    return { background: "rgba(185, 28, 28, 0.12)", color: "#991b1b", border: "1px solid rgba(185, 28, 28, 0.3)" };
  }
  return { background: "rgba(22, 163, 74, 0.12)", color: "#166534", border: "1px solid rgba(22, 163, 74, 0.28)" };
}

function xpLine(
  label: string,
  r: XPAwardResult,
  locale: "ko" | "en",
): string {
  const amt = r.allowedAmount;
  const blocked =
    r.blockedReason === "lockout_all_xp"
      ? locale === "ko"
        ? "잠금으로 지급 불가"
        : "Blocked (lockout)"
      : r.blockedReason === "integrity_slip_weekly_xp"
        ? locale === "ko"
          ? "무결성 이탈로 주간 XP 지급 불가"
          : "Weekly blocked (integrity slip)"
        : null;
  if (!r.allowed && blocked) return `${label}: 0 — ${blocked}`;
  return `${label}: +${amt}`;
}

function airBandCopy(band: AIRBand, loc: Locale): string {
  const b = getMessages(loc).bty;
  if (band === "low") return b.airBandLow;
  if (band === "mid") return b.airBandMid;
  return b.airBandHigh;
}

export type SessionSummaryOverlayProps = {
  open: boolean;
  locale: "ko" | "en";
  scenarioTitle: string;
  chosenOptionText: string;
  sessionFlagBadge: SessionFlagBadgeVariant;
  xpAwardCore: XPAwardResult;
  xpAwardWeekly: XPAwardResult;
  previousAir: number;
  newAir: number;
  /** From {@link getPatternNarrative} when XP integrity gate fired (server). */
  patternNarrativeLine?: string | null;
  foundryUnlockFired: boolean;
  /** e.g. `/ko/bty/foundry` */
  foundryHref: string;
  onDismiss?: () => void;
  onNextScenario?: () => void;
  /**
   * When set, Foundry CTA awaits this (recommendations / prefetch) before `router.push(foundryHref)`.
   * Omit to use a plain {@link Link} without an async gate.
   */
  onFoundryBeforeNavigate?: () => Promise<void>;
  className?: string;
};

export function SessionSummaryOverlay({
  open,
  locale,
  scenarioTitle,
  chosenOptionText,
  sessionFlagBadge,
  xpAwardCore,
  xpAwardWeekly,
  previousAir,
  newAir,
  patternNarrativeLine,
  foundryUnlockFired,
  foundryHref,
  onDismiss,
  onNextScenario,
  onFoundryBeforeNavigate,
  className,
}: SessionSummaryOverlayProps) {
  const router = useRouter();
  const loc = locale === "ko" ? "ko" : "en";
  const a = getMessages(loc).arena;

  if (!open) return null;

  const narrative =
    typeof patternNarrativeLine === "string" && patternNarrativeLine.trim().length > 0
      ? patternNarrativeLine.trim()
      : null;

  const beforeBand = airToBand(previousAir);
  const afterBand = airToBand(newAir);

  const title = locale === "ko" ? "세션 완료" : "Session complete";
  const choiceLabel = locale === "ko" ? "선택" : "Choice";
  const coreLbl = locale === "ko" ? "코어 XP" : "Core XP";
  const weekLbl = locale === "ko" ? "주간 XP" : "Weekly XP";
  const nextCta = locale === "ko" ? "다음 시나리오" : "Next scenario";
  const foundryCta = locale === "ko" ? "Foundry로 이동" : "Go to Foundry";
  const closeLbl = locale === "ko" ? "닫기" : "Close";

  const requestNext = React.useCallback(() => {
    void (async () => {
      await Promise.resolve(onNextScenario?.());
      window.dispatchEvent(new CustomEvent(NEXT_SCENARIO_REQUESTED_EVENT));
    })();
  }, [onNextScenario]);

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 ${className ?? ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-summary-overlay-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--arena-text-soft)]/25 bg-[var(--arena-card,#faf8f5)] p-6 shadow-xl">
        <h2 id="session-summary-overlay-title" className="text-lg font-semibold text-[var(--arena-text)]">
          {title}
        </h2>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
            style={badgeStyles(sessionFlagBadge)}
          >
            {badgeLabel(sessionFlagBadge, locale)}
          </span>
        </div>

        <p className="mt-3 text-sm font-medium text-[var(--arena-text)]">{scenarioTitle}</p>
        <p className="mt-1 text-xs text-[var(--arena-text-soft)]">
          {choiceLabel}: {chosenOptionText}
        </p>

        <div className="mt-4 space-y-1 rounded-xl border border-[var(--arena-text-soft)]/20 bg-[var(--arena-bg,#fff)]/80 p-3 text-sm text-[var(--arena-text)]">
          <p className="m-0 font-medium">{xpLine(coreLbl, xpAwardCore, locale)}</p>
          <p className="m-0">{xpLine(weekLbl, xpAwardWeekly, locale)}</p>
        </div>

        <div className="mt-4">
          <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--arena-text-soft)]">
            {a.sessionSummaryExecutionIntegrityHeading}
          </p>
          <div className="flex flex-col gap-1 rounded-xl border border-[var(--arena-text-soft)]/20 bg-[var(--arena-bg,#fff)]/80 p-3 text-sm text-[var(--arena-text)]">
            <p className="m-0">
              <span className="text-[var(--arena-text-soft)]">{a.sessionSummaryAirBandBefore}: </span>
              <span className="font-semibold">{airBandCopy(beforeBand, loc)}</span>
            </p>
            <p className="m-0">
              <span className="text-[var(--arena-text-soft)]">{a.sessionSummaryAirBandAfter}: </span>
              <span className="font-semibold">{airBandCopy(afterBand, loc)}</span>
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--arena-text-soft)]">
            {getMessages(loc).bty.airExecutionIntegrityFootnote}
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/90 p-3">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {a.sessionSummaryPatternShiftHeading}
          </p>
          <p className="mt-2 m-0 text-xs leading-relaxed text-slate-600">{a.sessionSummaryPatternShiftPlaceholder}</p>
        </div>

        {narrative ? (
          <div className="mt-4 rounded-xl border border-[var(--arena-text-soft)]/25 bg-[var(--arena-bg,#fff)]/90 p-3">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--arena-text-soft)]">
              {a.sessionSummaryContextNoteHeading}
            </p>
            <p className="mt-1 m-0 text-sm leading-relaxed text-[var(--arena-text)]">{narrative}</p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="w-full rounded-lg border border-[var(--arena-accent)]/40 bg-[var(--arena-accent)]/15 py-2.5 text-sm font-semibold text-[var(--arena-accent)]"
            onClick={requestNext}
          >
            {nextCta}
          </button>
          {foundryUnlockFired ? (
            onFoundryBeforeNavigate ? (
              <button
                type="button"
                className="block w-full rounded-lg border border-[var(--arena-text-soft)]/30 bg-[var(--arena-bg,#fff)] py-2.5 text-center text-sm font-semibold text-[var(--arena-text)]"
                onClick={async () => {
                  await onFoundryBeforeNavigate();
                  router.push(foundryHref);
                }}
              >
                {foundryCta}
              </button>
            ) : (
              <Link
                href={foundryHref}
                className="block w-full rounded-lg border border-[var(--arena-text-soft)]/30 bg-[var(--arena-bg,#fff)] py-2.5 text-center text-sm font-semibold text-[var(--arena-text)]"
              >
                {foundryCta}
              </Link>
            )
          ) : null}
          <button
            type="button"
            className="w-full rounded-lg py-2 text-sm text-[var(--arena-text-soft)] underline"
            onClick={onDismiss}
          >
            {closeLbl}
          </button>
        </div>
      </div>
    </div>
  );
}
