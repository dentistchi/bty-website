"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type DayState = "completed" | "current" | "upcoming";

export type BtyJourneyBoardProps = {
  locale: string;
  currentDay: number;
  totalDays?: number;
  statusText?: string;
  onContinue: (day: number) => void;
  onRestart: () => void;
};

function getDayState(day: number, currentDay: number): DayState {
  if (day < currentDay) return "completed";
  if (day === currentDay) return "current";
  return "upcoming";
}

export default function JourneyBoard({
  locale,
  currentDay,
  totalDays = 28,
  statusText = "Recovery sequence active.",
  onContinue,
  onRestart,
}: BtyJourneyBoardProps) {
  const days = useMemo(() => Array.from({ length: totalDays }, (_, index) => index + 1), [totalDays]);

  return (
    <div className="min-h-screen bg-[#F6F4EE] px-4 py-6 pb-28 text-[#1F2937]">
      <div data-testid="journey-board" className="mx-auto max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href={`/${locale}/growth`}
            className="inline-flex items-center rounded-2xl border border-[#E8E3D8] bg-white px-3 py-2 text-sm text-[#405A74] shadow-sm"
          >
            Back
          </Link>
          <span className="rounded-full bg-[#1E2A38] px-3 py-1 text-xs font-medium text-white">Journey</span>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#667085]">Recovery Loop</p>
          <h1
            data-testid="journey-current-day"
            className="text-3xl font-semibold tracking-tight text-[#1E2A38]"
          >
            Day {currentDay}
          </h1>
          <p data-testid="journey-status-text" className="text-sm leading-6 text-[#667085]">
            {statusText}
          </p>
        </div>

        <div className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[#1E2A38]">Current Path</p>
              <p className="mt-1 text-xs text-[#667085]">Progress continues from your current path.</p>
            </div>
            <div className="shrink-0 rounded-2xl bg-[#F1EEE6] px-3 py-2 text-right">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#667085]">Current Day</p>
              <p className="text-lg font-semibold text-[#1E2A38]">{currentDay}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {days.map((day) => {
              const state = getDayState(day, currentDay);
              return (
                <div
                  key={day}
                  data-testid={`journey-day-cell-${String(day).padStart(2, "0")}`}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-2xl border text-center transition-all",
                    state === "completed" && "border-[#D8D0C0] bg-[#F1EEE6] text-[#4D6B57]",
                    state === "current" &&
                      "border-[#B08D57] bg-[#FFF8EE] text-[#1E2A38] shadow-sm ring-1 ring-[#E5C68B]",
                    state === "upcoming" && "border-[#ECE7DC] bg-white text-[#98A2B3]"
                  )}
                >
                  <span className="text-[10px] uppercase tracking-[0.12em]">Day</span>
                  <span className="mt-1 text-sm font-semibold">{String(day).padStart(2, "0")}</span>
                  <span className="mt-1 text-xs">
                    {state === "completed" ? "✓" : state === "current" ? "●" : "·"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#1E2A38]">System Note</p>
            <p className="text-sm leading-6 text-[#667085]">
              Sequence remains open. Continue from the current path when ready.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            <button
              type="button"
              data-testid="journey-continue-button"
              onClick={() => onContinue(currentDay)}
              className="h-12 w-full rounded-2xl bg-[#1E2A38] px-4 text-sm font-medium text-white hover:bg-[#243446]"
            >
              Continue Day {currentDay}
            </button>

            <button
              type="button"
              data-testid="journey-restart-button"
              onClick={onRestart}
              className="h-12 w-full rounded-2xl border border-[#D7CFBF] bg-transparent px-4 text-sm font-medium text-[#405A74] hover:bg-[#F6F4EE]"
            >
              Restart Journey
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
