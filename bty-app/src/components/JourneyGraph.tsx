"use client";

import { useEffect, useMemo, useState } from "react";
import { getPracticeLog, type PracticeEntry } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * 나의 여정 — 파도 모양 그래프 위에 기록한 날짜를 점으로 표시
 * LocalStorage 데이터를 읽어와 점을 찍음
 * - window 이벤트 "bty-practice-updated" 수신 시 자동 갱신
 */

const WAVE_PATH =
  "M 0 22 C 20 22 30 55 50 55 C 70 55 80 22 100 22";

function waveY(x: number): number {
  if (x <= 0 || x >= 100) return 22;
  const t = x / 100;
  return 22 + 33 * (1 - Math.cos(Math.PI * t));
}

function getDots(entries: PracticeEntry[]): { x: number; y: number; type: "success" | "failure" }[] {
  if (entries.length === 0) return [];
  if (entries.length === 1) {
    const x = 50;
    return [{ x, y: waveY(x), type: entries[0].type }];
  }
  return entries.map((e, i) => {
    const x = (100 * i) / (entries.length - 1);
    return { x, y: waveY(x), type: e.type };
  });
}

export function JourneyGraph({ className }: { className?: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((k) => k + 1);
    window.addEventListener("bty-practice-updated", handler);
    return () => window.removeEventListener("bty-practice-updated", handler);
  }, []);

  const { entries } = useMemo(
    () => ({ entries: getPracticeLog(), tick }),
    [tick]
  );
  const entryDots = useMemo(() => getDots(entries), [entries]);

  if (entries.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dojo-purple-muted bg-dojo-white p-6 sm:p-8",
          "border-dojo-purple-muted bg-dojo-purple-muted/10",
          className
        )}
      >
        <h3 className="text-lg font-medium text-dojo-purple-dark mb-1">나의 여정</h3>
        <p className="text-sm text-dojo-ink-soft mb-4">
          오늘의 연습을 기록하면 여기에 점이 쌓여요.
        </p>
        <div className="w-full aspect-[2/1] min-h-[120px] flex items-end">
          <svg
            viewBox="0 0 100 60"
            preserveAspectRatio="none"
            className="w-full h-full opacity-60"
          >
            <path
              d={WAVE_PATH}
              fill="none"
              stroke="#5B4B8A"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label="나의 여정 그래프"
      className={cn(
        "rounded-2xl border border-dojo-purple-muted bg-dojo-white overflow-hidden shadow-sm",
        className
      )}
    >
      <div className="p-6 sm:p-8 border-b border-dojo-purple-muted bg-dojo-purple/5">
        <h3 className="text-lg font-medium text-dojo-purple-dark">나의 여정</h3>
        <p className="text-sm text-dojo-ink-soft mt-1">
          기록한 날이 파도 위에 점으로 쌓여요.
        </p>
      </div>
      <div className="p-6 sm:p-8">
        <div className="w-full aspect-[2/1] min-h-[140px] flex items-end relative">
          <svg
            viewBox="0 0 100 60"
            preserveAspectRatio="none"
            className="w-full h-full"
            style={{ overflow: "visible" }}
          >
            <defs>
              <linearGradient id="journey-fill" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#5B4B8A" stopOpacity="0" />
                <stop offset="100%" stopColor="#5B4B8A" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <path
              d="M 0 22 C 20 22 30 55 50 55 C 70 55 80 22 100 22 L 100 60 L 0 60 Z"
              fill="url(#journey-fill)"
            />
            <path
              d={WAVE_PATH}
              fill="none"
              stroke="#5B4B8A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {entryDots.map((d, i) => (
              <circle
                key={i}
                cx={d.x}
                cy={d.y}
                r="4"
                fill={d.type === "success" ? "#5B4B8A" : "#7B6BA8"}
                stroke="#fff"
                strokeWidth="1.5"
              />
            ))}
          </svg>
        </div>
        <div className="flex justify-between mt-2 text-xs text-dojo-ink-soft">
          <span>처음</span>
          <span>지금</span>
        </div>
      </div>
    </div>
  );
}
