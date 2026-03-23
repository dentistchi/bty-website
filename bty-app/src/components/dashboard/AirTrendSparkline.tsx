"use client";

/**
 * Shared 30-day AIR line (no axes) — same Chart.js setup as {@link AIRTrendWidget}.
 */

import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { AIRTrendDirection } from "@/engine/integrity/air-trend.service";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler);

export type AirTrendSparklineProps = {
  dailyAir: readonly number[];
  direction: AIRTrendDirection;
  height?: number;
};

export function AirTrendSparkline({ dailyAir, direction, height = 72 }: AirTrendSparklineProps) {
  const daily = dailyAir.map((v) => (Number.isFinite(v) ? v : 0));
  const sparkStroke =
    direction === "improving" ? "#0d9488" : direction === "declining" ? "#dc2626" : "#64748b";

  const chartData = {
    labels: daily.map(() => ""),
    datasets: [
      {
        data: daily,
        borderColor: sparkStroke,
        backgroundColor: "transparent",
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false, min: 0, max: 1 },
    },
    interaction: { mode: "nearest" as const, intersect: false },
  };

  return (
    <div style={{ height, minWidth: 0 }} aria-hidden>
      <Line data={chartData} options={chartOptions} />
    </div>
  );
}
