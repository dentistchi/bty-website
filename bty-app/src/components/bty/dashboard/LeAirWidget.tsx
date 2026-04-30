"use client";

import type { AIRBand } from "@/domain/leadership-engine/air";
import { CardSkeleton } from "@/components/bty-arena";

/**
 * Foundry 대시보드 — AIR 스냅샷 위젯.
 * Render-only: `data`는 GET /api/arena/leadership-engine/air 응답 그대로 표시. Raw `air`는 표시하지 않고 `band`만.
 */
export type LeAirSnapshot = {
  air_7d: { missedWindows: number; integritySlip: boolean; band: AIRBand; score_hidden?: boolean };
  air_14d: { missedWindows: number; integritySlip: boolean; band: AIRBand; score_hidden?: boolean };
  air_90d: { missedWindows: number; integritySlip: boolean; band: AIRBand; score_hidden?: boolean };
};

export type LeAirWidgetLabels = {
  regionMain: string;
  regionGrid: string;
  region7d: string;
  region14d: string;
  region90d: string;
  period7d: string;
  period14d: string;
  period90d: string;
  integritySlip: string;
  airUnavailable: string;
  /** 대시보드 초기 로딩 중 */
  airLoading: string;
  bandLow: string;
  bandMid: string;
  bandHigh: string;
  executionFootnote: string;
};

function bandLabel(band: AIRBand, labels: LeAirWidgetLabels): string {
  if (band === "low") return labels.bandLow;
  if (band === "mid") return labels.bandMid;
  return labels.bandHigh;
}

function bandAccent(band: AIRBand): string {
  if (band === "high") return "var(--arena-accent, #22d3ee)";
  if (band === "mid") return "rgba(148, 163, 184, 0.95)";
  return "rgba(251, 191, 36, 0.9)";
}

export function LeAirWidget({
  data,
  dashboardLoading,
  labels,
}: {
  data: LeAirSnapshot | null;
  dashboardLoading: boolean;
  labels: LeAirWidgetLabels;
}) {
  if (dashboardLoading && data == null) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label={labels.airLoading}
        style={{ display: "block" }}
      >
        <CardSkeleton showLabel={false} lines={2} />
      </div>
    );
  }

  if (data == null) {
    return (
      <div role="region" aria-label={labels.regionMain} style={{ display: "block" }}>
        <p style={{ fontSize: 13, color: "var(--arena-text)", opacity: 0.8 }} role="status">
          {labels.airUnavailable}
        </p>
      </div>
    );
  }

  const cell = (window: LeAirSnapshot["air_7d"], period: string, aria: string) => (
    <div
      role="group"
      aria-label={aria}
      style={{
        textAlign: "center",
        padding: "12px 8px",
        border: "1px solid var(--arena-text-soft, #e5e7eb)",
        borderRadius: 10,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 20, color: bandAccent(window.band) }}>
        {bandLabel(window.band, labels)}
      </div>
      <div style={{ marginTop: 4, opacity: 0.8 }}>{period}</div>
      {window.integritySlip && (
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--arena-accent)" }}>{labels.integritySlip}</div>
      )}
    </div>
  );

  return (
    <div role="region" aria-label={labels.regionGrid} style={{ display: "block" }}>
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, fontSize: 14 }}
      >
        {cell(data.air_7d, labels.period7d, labels.region7d)}
        {cell(data.air_14d, labels.period14d, labels.region14d)}
        {cell(data.air_90d, labels.period90d, labels.region90d)}
      </div>
      <p style={{ marginTop: 12, fontSize: 11, lineHeight: 1.45, opacity: 0.75 }}>{labels.executionFootnote}</p>
    </div>
  );
}
