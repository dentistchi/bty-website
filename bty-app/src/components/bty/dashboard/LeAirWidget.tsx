"use client";

import { CardSkeleton } from "@/components/bty-arena";

/**
 * Foundry 대시보드 — AIR 스냅샷 위젯.
 * Render-only: `data`는 GET /api/arena/leadership-engine/air 응답 그대로 표시(퍼센트는 표시용 ×100만).
 */
export type LeAirSnapshot = {
  air_7d: { air: number; missedWindows: number; integritySlip: boolean };
  air_14d: { air: number; missedWindows: number; integritySlip: boolean };
  air_90d: { air: number; missedWindows: number; integritySlip: boolean };
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
};

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
      <div style={{ fontWeight: 700, fontSize: 20 }}>{(window.air * 100).toFixed(0)}%</div>
      <div style={{ marginTop: 4, opacity: 0.8 }}>{period}</div>
      {window.integritySlip && (
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--arena-accent)" }}>{labels.integritySlip}</div>
      )}
    </div>
  );

  return (
    <div
      role="region"
      aria-label={labels.regionGrid}
      style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, fontSize: 14 }}
    >
      {cell(data.air_7d, labels.period7d, labels.region7d)}
      {cell(data.air_14d, labels.period14d, labels.region14d)}
      {cell(data.air_90d, labels.period90d, labels.region90d)}
    </div>
  );
}
