"use client";

import React from "react";

/** `le_activation_log.type` 등 → 배지 문구 (Hero Trap / Integrity Slip 예시 반영). */
const FLAG_TYPE_BADGE_LABEL: Record<string, string> = {
  micro_win: "Micro-win",
  reset: "Reset",
  integrity_slip: "Integrity Slip",
  hero_trap: "Hero Trap",
};

export function getFlagBadgeLabel(flagType: string | null | undefined): string {
  if (flagType == null || String(flagType).trim() === "") return "";
  const k = String(flagType).trim();
  return FLAG_TYPE_BADGE_LABEL[k] ?? k;
}

export type PatternNarrativeBannerProps = {
  /**
   * 서버·부모에서 `getPatternNarrative(userId)` 결과를 넘김 (한국어 문장).
   * @see `@/engine/memory/pattern-history.service` `getPatternNarrative`
   */
  patternNarrativeKo: string;
  /** 시나리오 축 태그 (`le_activation_log.scenario_type` 등, 없으면 `일반`). */
  scenarioType: string | null;
  /** 직전 AIR 플래그 타입 배지 (`le_activation_log.type` 등). */
  previousFlagType: string | null;
  /** 자동 닫힘(기본 8초). */
  autoDismissMs?: number;
  /** 확인 또는 자동 닫힘 시 */
  onDismiss?: () => void;
  /** 확인 버튼 라벨(기본 한국어). */
  confirmLabel?: string;
  className?: string;
  style?: React.CSSProperties;
};

function scenarioTagLabel(scenarioType: string | null): string {
  const s = typeof scenarioType === "string" ? scenarioType.trim() : "";
  return s !== "" ? s : "일반";
}

/**
 * Arena 세션 시작 시 패턴 내레이션 배너 — 8초 후 자동 닫힘 또는 확인 탭.
 * `patternNarrativeKo`는 API/서버에서 `getPatternNarrative`로 조회한 뒤 전달.
 */
export function PatternNarrativeBanner({
  patternNarrativeKo,
  scenarioType,
  previousFlagType,
  autoDismissMs = 8000,
  onDismiss,
  confirmLabel = "확인",
  className,
  style,
}: PatternNarrativeBannerProps) {
  const narrative = typeof patternNarrativeKo === "string" ? patternNarrativeKo.trim() : "";
  const hasNarrative = narrative.length > 0;
  const hasFlag = previousFlagType != null && String(previousFlagType).trim() !== "";
  const hasScenario = scenarioType != null && String(scenarioType).trim() !== "";
  const shouldShow = hasNarrative || hasFlag || hasScenario;

  const [visible, setVisible] = React.useState(true);

  const dismiss = React.useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  React.useEffect(() => {
    if (!shouldShow || !visible) return;
    const t = window.setTimeout(dismiss, autoDismissMs);
    return () => window.clearTimeout(t);
  }, [autoDismissMs, dismiss, shouldShow, visible]);

  if (!shouldShow) return null;
  if (!visible) return null;

  const flagLabel = hasFlag ? getFlagBadgeLabel(previousFlagType) : "";

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pattern-narrative-banner"
      className={className}
      style={{
        position: "relative",
        padding: "14px 16px 48px",
        borderRadius: 14,
        border: "1px solid #e8e3d8",
        background: "var(--arena-card, #faf8f5)",
        boxShadow: "0 4px 20px rgba(30, 42, 56, 0.08)",
        ...style,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "4px 8px",
            borderRadius: 6,
            background: "#eef2f6",
            color: "#405a74",
          }}
        >
          {scenarioTagLabel(scenarioType)}
        </span>
        {hasFlag ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(64, 90, 116, 0.12)",
              color: "#1e2a38",
              border: "1px solid rgba(64, 90, 116, 0.25)",
            }}
          >
            {flagLabel}
          </span>
        ) : null}
      </div>

      {hasNarrative ? (
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.55,
            color: "var(--arena-text, #1e2a38)",
          }}
        >
          {narrative}
        </p>
      ) : null}

      <button
        type="button"
        onClick={dismiss}
        style={{
          position: "absolute",
          right: 12,
          bottom: 10,
          padding: "6px 14px",
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 8,
          border: "1px solid #d7cfbf",
          background: "#fff",
          cursor: "pointer",
          color: "#1e2a38",
        }}
        aria-label={confirmLabel}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
