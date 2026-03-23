"use client";

/**
 * 7-day delayed Arena outcome — GET `/api/arena/session/delayed-outcomes`, dismiss → POST
 * `/api/arena/session/delayed-outcomes/dismiss` (`outcomeId`); server runs {@link scheduleOutcomes} after mark delivered.
 * At most one due outcome per page session (first in list).
 */

import React from "react";
import type { DelayedOutcome } from "@/engine/scenario/delayed-outcome-trigger.service";
import { getMessages } from "@/lib/i18n";

type MentorFlagBucket = "HERO_TRAP" | "INTEGRITY_SLIP" | "CLEAN" | "ROLE_MIRROR";

function bucketFromChoiceType(choiceType: string): MentorFlagBucket {
  const m = choiceType.match(/^delayed_([A-Z_]+)_v\d$/i);
  const raw = (m?.[1] ?? "CLEAN").toUpperCase();
  if (raw === "HERO_TRAP" || (raw.includes("HERO") && raw.includes("TRAP"))) return "HERO_TRAP";
  if (raw === "INTEGRITY_SLIP" || raw.includes("INTEGRITY")) return "INTEGRITY_SLIP";
  if (raw === "ROLE_MIRROR" || raw.includes("ROLE") || raw.includes("MIRROR")) return "ROLE_MIRROR";
  return "CLEAN";
}

function badgeStyle(bucket: MentorFlagBucket): React.CSSProperties {
  switch (bucket) {
    case "HERO_TRAP":
      return {
        background: "rgba(180, 83, 9, 0.15)",
        color: "#92400e",
        border: "1px solid rgba(180, 83, 9, 0.35)",
      };
    case "INTEGRITY_SLIP":
      return {
        background: "rgba(185, 28, 28, 0.12)",
        color: "#991b1b",
        border: "1px solid rgba(185, 28, 28, 0.3)",
      };
    case "ROLE_MIRROR":
      return {
        background: "rgba(109, 40, 217, 0.12)",
        color: "#5b21b6",
        border: "1px solid rgba(109, 40, 217, 0.28)",
      };
    default:
      return {
        background: "rgba(22, 163, 74, 0.12)",
        color: "#166534",
        border: "1px solid rgba(22, 163, 74, 0.28)",
      };
  }
}

function badgeLabel(
  bucket: MentorFlagBucket,
  loc: "ko" | "en",
  t: ReturnType<typeof getMessages>["uxPhase1Stub"],
): string {
  switch (bucket) {
    case "HERO_TRAP":
      return t.delayedOutcomeFlagHeroTrap;
    case "INTEGRITY_SLIP":
      return t.delayedOutcomeFlagIntegritySlip;
    case "ROLE_MIRROR":
      return t.delayedOutcomeFlagRoleMirror;
    default:
      return t.delayedOutcomeFlagClean;
  }
}

export type DelayedOutcomeBannerProps = {
  locale: "ko" | "en";
  className?: string;
};

export function DelayedOutcomeBanner({ locale, className }: DelayedOutcomeBannerProps) {
  const t = getMessages(locale).uxPhase1Stub;

  const [outcome, setOutcome] = React.useState<DelayedOutcome | null>(null);
  const [entered, setEntered] = React.useState(false);
  const [dismissing, setDismissing] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setEntered(false);
    (async () => {
      try {
        const r = await fetch(
          `/api/arena/session/delayed-outcomes?locale=${encodeURIComponent(locale)}`,
          { credentials: "include" },
        );
        const json = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          outcomes?: DelayedOutcome[];
        };
        if (!cancelled && r.ok && json.ok && Array.isArray(json.outcomes) && json.outcomes.length > 0) {
          setOutcome(json.outcomes[0]!);
        }
      } catch {
        if (!cancelled) setOutcome(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  React.useEffect(() => {
    if (!outcome) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [outcome]);

  const dismiss = React.useCallback(async () => {
    if (!outcome || dismissing) return;
    setDismissing(true);
    try {
      await fetch("/api/arena/session/delayed-outcomes/dismiss", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeId: outcome.pendingOutcomeId }),
      });
    } finally {
      setOutcome(null);
      setEntered(false);
      setDismissing(false);
    }
  }, [outcome, dismissing]);

  if (!outcome) return null;

  const bucket = bucketFromChoiceType(outcome.choiceTypeKey);
  const title = locale === "ko" ? outcome.titleKo : outcome.titleEn;

  return (
    <div className={className} style={{ overflow: "hidden", marginBottom: 12 }}>
      <section
        role="region"
        aria-label={t.delayedOutcomeBannerRegionAria}
        style={{
          transform: entered ? "translateY(0)" : "translateY(-100%)",
          transition: "transform 300ms ease-out",
          borderRadius: 12,
          border: "1px solid rgba(148, 163, 184, 0.35)",
          background: "var(--arena-card, #f8fafc)",
          padding: "12px 14px",
          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#64748b",
                }}
              >
                {t.delayedOutcomeBannerRegionAria}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  ...badgeStyle(bucket),
                }}
              >
                {badgeLabel(bucket, locale, t)}
              </span>
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{title}</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "#334155" }}>{t.delayedOutcomeIntro}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            onClick={() => void dismiss()}
            disabled={dismissing}
            aria-label={t.delayedOutcomeDismiss}
          >
            {t.delayedOutcomeDismiss}
          </button>
        </div>
      </section>
    </div>
  );
}
