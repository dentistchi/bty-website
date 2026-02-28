"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type ArenaLevelInfo = {
  level: string;
  title?: string;
  title_ko?: string;
  items?: unknown[];
};

export interface ArenaLevelsCardProps {
  /** staff | leader */
  track: "staff" | "leader";
  /** Highest unlocked level id (e.g. S2, L1) */
  maxUnlockedLevel: string | null;
  /** Levels from API (with item counts) */
  levels: ArenaLevelInfo[];
  /** L4 (Partner) admin-granted access */
  l4Access?: boolean;
  /** Show "membership pending" message instead of levels */
  membershipPending?: boolean;
  /** Locale for i18n (en | ko) */
  locale?: string;
}

const STAFF_ORDER = ["S1", "S2", "S3"];
const LEADER_ORDER = ["L1", "L2", "L3"];

function toLocale(s: string | undefined): Locale {
  return s === "ko" ? "ko" : "en";
}

/**
 * Bar + Steps: horizontal progress bar with level steps.
 * maxUnlockedLevel step is highlighted (blink). Locked steps are dimmed.
 * Renders only; all values from API.
 */
export function ArenaLevelsCard({
  track,
  maxUnlockedLevel,
  levels,
  l4Access = false,
  membershipPending = false,
  locale = "en",
}: ArenaLevelsCardProps) {
  const t = getMessages(toLocale(locale)).arenaLevels;
  const [reduceMotion, setReduceMotion] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (membershipPending) {
    return (
      <div style={{ padding: "12px 0", fontSize: 14, opacity: 0.9 }} role="status">
        {t.membershipPending}
      </div>
    );
  }

  const order = track === "staff" ? STAFF_ORDER : [...LEADER_ORDER, ...(l4Access ? ["L4"] : [])];
  const levelMap = new Map((levels ?? []).map((l) => [l.level, l]));
  const maxIndex = maxUnlockedLevel ? order.indexOf(maxUnlockedLevel) : -1;
  const trackLabel = track === "staff" ? t.staff : t.leader;
  const l4Label = t.l4Partner;

  return (
    <div role="region" aria-label="Arena levels progress">
      <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
        <span style={{ fontWeight: 700 }}>{t.track}:</span> {trackLabel}
        {maxUnlockedLevel && (
          <>
            {" · "}
            <span style={{ fontWeight: 700 }}>{t.unlockedUpTo}:</span> {maxUnlockedLevel}
          </>
        )}
        {l4Access && (
          <>
            {" · "}
            <span style={{ fontWeight: 600 }}>{l4Label}</span> — {t.l4AdminGranted}
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 4,
          marginTop: 12,
          marginBottom: 8,
        }}
      >
        {order.map((levelId, index) => {
          const info = levelMap.get(levelId);
          const count = Array.isArray(info?.items) ? info.items.length : 0;
          const isUnlocked = maxIndex >= index;
          const isCurrent = maxUnlockedLevel === levelId;
          const label = levelId === "L4" ? l4Label : levelId;

          return (
            <div
              key={levelId}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  opacity: isUnlocked ? 0.9 : 0.45,
                  fontWeight: isCurrent ? 800 : 600,
                }}
              >
                {label}
                {count > 0 && ` (${count})`}
              </div>
              <div
                className={isCurrent && !reduceMotion ? "arena-level-step-current" : undefined}
                style={{
                  width: "100%",
                  height: 10,
                  borderRadius: 4,
                  background: isUnlocked ? (isCurrent ? "#111" : "#ddd") : "#eee",
                  opacity: isUnlocked ? 1 : 0.5,
                  minWidth: 24,
                }}
              />
            </div>
          );
        })}
      </div>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .arena-level-step-current { animation: none !important; }
        }
        @keyframes arena-level-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .arena-level-step-current {
          animation: arena-level-blink 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
