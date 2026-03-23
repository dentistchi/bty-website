import type { CSSProperties } from "react";
import {
  ARENA_LAB_SCORE_ATTEMPT_LIMIT,
  ARENA_LAB_SCORE_MAX,
  calculateArenaLabScore,
  type CalculateArenaLabScoreInput,
} from "@/domain/arena/lab/calculateArenaLabScore";
import type { ArenaLabDifficultyKey } from "@/domain/arena/scenarios/arenaLabDifficultyKeyFromUnknown";

/** `uxPhase1Stub` 의 `arenaLabScore*` 키만 묶어서 전달 */
export type ArenaLabScoreCardLabels = {
  arenaLabScoreCardRegionAria: string;
  arenaLabScoreTitle: string;
  arenaLabScoreSlashMax: string;
  arenaLabScoreDifficultyPrefix: string;
  arenaLabScoreAttemptPrefix: string;
  arenaLabScoreDifficultyEasy: string;
  arenaLabScoreDifficultyMid: string;
  arenaLabScoreDifficultyHard: string;
  arenaLabScoreDifficultyExtreme: string;
};

export type ArenaLabScoreCardProps = {
  difficulty: ArenaLabDifficultyKey;
  attemptCount: CalculateArenaLabScoreInput["attemptCount"];
  labels: ArenaLabScoreCardLabels;
  style?: CSSProperties;
};

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : "",
  );
}

function difficultyDisplayName(key: ArenaLabDifficultyKey, labels: ArenaLabScoreCardLabels): string {
  switch (key) {
    case "easy":
      return labels.arenaLabScoreDifficultyEasy;
    case "mid":
      return labels.arenaLabScoreDifficultyMid;
    case "hard":
      return labels.arenaLabScoreDifficultyHard;
    case "extreme":
      return labels.arenaLabScoreDifficultyExtreme;
  }
}

/**
 * Leadership Lab — `calculateArenaLabScore` 결과만 표시(render-only · 규칙은 domain).
 */
export function ArenaLabScoreCard({ difficulty, attemptCount, labels, style }: ArenaLabScoreCardProps) {
  const input: CalculateArenaLabScoreInput = { difficulty, attemptCount };
  const score = calculateArenaLabScore(input);
  const slashMax = interpolate(labels.arenaLabScoreSlashMax, {
    score,
    max: ARENA_LAB_SCORE_MAX,
  });
  const diffName = difficultyDisplayName(difficulty, labels);

  return (
    <section
      data-testid="arena-lab-score-card"
      role="region"
      aria-label={labels.arenaLabScoreCardRegionAria}
      style={{
        marginTop: 0,
        padding: "18px 20px",
        border: "1px solid #eee",
        borderRadius: 14,
        background: "var(--arena-card)",
        ...style,
      }}
    >
      <p
        style={{
          margin: "0 0 10px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--arena-text-soft)",
          letterSpacing: "0.02em",
        }}
      >
        {labels.arenaLabScoreTitle}
      </p>
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1.2,
          color: "var(--arena-text)",
          fontVariantNumeric: "tabular-nums",
        }}
        aria-label={slashMax}
      >
        {slashMax}
      </p>
      <dl
        style={{
          margin: 0,
          display: "grid",
          gap: 6,
          fontSize: 14,
          color: "var(--arena-text)",
          opacity: 0.92,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <dt style={{ margin: 0, fontWeight: 600 }}>{labels.arenaLabScoreDifficultyPrefix}</dt>
          <dd style={{ margin: 0 }}>{diffName}</dd>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <dt style={{ margin: 0, fontWeight: 600 }}>{labels.arenaLabScoreAttemptPrefix}</dt>
          <dd style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>
            {attemptCount} / {ARENA_LAB_SCORE_ATTEMPT_LIMIT}
          </dd>
        </div>
      </dl>
    </section>
  );
}
