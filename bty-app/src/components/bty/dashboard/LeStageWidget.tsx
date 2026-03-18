"use client";

import { CardSkeleton } from "@/components/bty-arena";
import { clampDashboardLeProgressDisplayPercent } from "@/domain/dashboard";

/**
 * Foundry 대시보드 — LE Stage 요약 위젯.
 * Render-only: `data`는 GET /api/arena/leadership-engine/stage-summary 응답 그대로 표시.
 */
export type LeStageSummaryData = {
  currentStage: 1 | 2 | 3 | 4;
  stageName: string;
  progressPercent: number;
  forcedResetTriggeredAt: string | null;
  resetDueAt: string | null;
  arenaSummary: string | Record<string, unknown> | null;
  behaviorPattern: string | Record<string, unknown> | null;
};

export type LeStageWidgetLabels = {
  regionAria: string;
  stageLabel: string;
  resetDueLabel: string;
  arenaSummaryLabel: string;
  behaviorPatternLabel: string;
  unavailable: string;
  loadingStatus: string;
  leProgressBarAria: string;
};

export function LeStageWidget({
  data,
  dashboardLoading,
  labels,
  locale,
}: {
  data: LeStageSummaryData | null;
  dashboardLoading: boolean;
  labels: LeStageWidgetLabels;
  locale: string;
}) {
  if (dashboardLoading && data == null) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label={labels.loadingStatus}
      >
        <CardSkeleton showLabel={false} lines={2} />
      </div>
    );
  }

  if (data == null) {
    return (
      <div role="region" aria-label={labels.regionAria}>
        <p style={{ fontSize: 13, color: "var(--arena-text)", opacity: 0.85 }} role="status">
          {labels.unavailable}
        </p>
      </div>
    );
  }

  const fmt = (iso: string, locale: string) =>
    new Date(iso).toLocaleString(locale === "ko" ? "ko-KR" : "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });

  const lePct = clampDashboardLeProgressDisplayPercent(data.progressPercent);

  return (
    <div role="region" aria-label={labels.regionAria}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{data.stageName}</div>
      <div
        style={{ marginTop: 10 }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={lePct}
        aria-label={labels.leProgressBarAria}
      >
        <div
          style={{
            height: 10,
            borderRadius: 6,
            background: "color-mix(in srgb, var(--arena-text-soft, #888) 15%, transparent)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${lePct}%`,
              height: "100%",
              borderRadius: 6,
              background: "var(--arena-accent, #6366f1)",
              transition: "width 0.2s ease",
            }}
          />
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
        {labels.stageLabel} {data.currentStage} · {lePct}%
      </div>
      {data.resetDueAt != null && (
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          {labels.resetDueLabel}: {fmt(data.resetDueAt, locale)}
        </div>
      )}
      {data.arenaSummary != null && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--arena-text-soft, #e5e7eb)",
          }}
          role="group"
          aria-label={labels.arenaSummaryLabel}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{labels.arenaSummaryLabel}</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>
            {typeof data.arenaSummary === "string"
              ? data.arenaSummary
              : JSON.stringify(data.arenaSummary)}
          </div>
        </div>
      )}
      {data.behaviorPattern != null && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--arena-text-soft, #e5e7eb)",
          }}
          role="group"
          aria-label={labels.behaviorPatternLabel}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{labels.behaviorPatternLabel}</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>
            {typeof data.behaviorPattern === "string"
              ? data.behaviorPattern
              : JSON.stringify(data.behaviorPattern)}
          </div>
        </div>
      )}
    </div>
  );
}
