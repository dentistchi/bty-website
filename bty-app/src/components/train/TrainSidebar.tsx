"use client";

import React from "react";
import { cn } from "@/lib/utils";

const TOTAL_DAYS = 28;
const OPEN_HOUR = 5;

type LockReason = "too-early" | "need-prev-complete" | "wait-next-morning" | "ok" | "today";

export type TrainProgress = {
  startDateISO: string;
  completionsByDay: Record<string, string>;
};

export type DayState = {
  day: number;
  unlocked: boolean;
  completed: boolean;
  reason: LockReason;
  unlockAtISO?: string;
  calendarAllowed: boolean;
  prevCompleted: boolean;
};

function parseISODateToLocal(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, OPEN_HOUR, 0, 0, 0);
}

function daysSinceStartLocal(startDateISO: string) {
  const start = parseISODateToLocal(startDateISO);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function startOfUnlockDayLocal(prevCompletedAtISO: string) {
  const completed = new Date(prevCompletedAtISO);
  const unlock = new Date(completed);
  unlock.setDate(unlock.getDate() + 1);
  unlock.setHours(OPEN_HOUR, 0, 0, 0);
  return unlock;
}

function fmtLocal(unlockAtISO: string) {
  const d = new Date(unlockAtISO);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

export function getDayState(progress: TrainProgress, day: number): DayState {
  const passed = daysSinceStartLocal(progress.startDateISO);
  const calendarAllowed = passed >= (day - 1);

  const completed = !!progress.completionsByDay[String(day)];
  if (day === 1) {
    const unlocked = calendarAllowed;
    return {
      day,
      unlocked,
      completed,
      reason: unlocked ? "today" : "too-early",
      calendarAllowed,
      prevCompleted: true,
    };
  }

  const prev = String(day - 1);
  const prevCompletedAt = progress.completionsByDay[prev];
  const prevCompleted = !!prevCompletedAt;

  if (!prevCompleted) {
    return {
      day,
      unlocked: false,
      completed,
      reason: "need-prev-complete",
      calendarAllowed,
      prevCompleted,
    };
  }

  const unlockTime = startOfUnlockDayLocal(prevCompletedAt);
  const now = new Date();
  const morningGateAllowed = now >= unlockTime;

  const unlocked = calendarAllowed && morningGateAllowed;

  return {
    day,
    unlocked,
    completed,
    reason: !calendarAllowed ? "too-early" : !morningGateAllowed ? "wait-next-morning" : "ok",
    unlockAtISO: unlockTime.toISOString(),
    calendarAllowed,
    prevCompleted,
  };
}

export function computeDayStates(progress: TrainProgress): DayState[] {
  return Array.from({ length: TOTAL_DAYS }, (_, i) => getDayState(progress, i + 1));
}

/**
 * "오늘 수행 가능한 1개"를 반환
 * - unlocked && !completed 중 가장 작은 day (또는 가장 최신으로 하고 싶으면 로직 변경 가능)
 * - 하루 1실천을 강하게 하려면 "가장 이른 미완료 unlocked 1개"만 허용이 UX가 자연스러움
 */
export function getActionableDay(progress: TrainProgress): number | null {
  const states = computeDayStates(progress);
  const x = states.find((s) => s.unlocked && !s.completed);
  return x ? x.day : null;
}

/** 자동 선택: 가능하면 actionable day, 없으면 가장 마지막 완료 day, 그마저 없으면 1 */
export function getDefaultSelectedDay(progress: TrainProgress): number {
  const actionable = getActionableDay(progress);
  if (actionable) return actionable;

  const states = computeDayStates(progress);
  const completedDays = states.filter((s) => s.completed).map((s) => s.day);
  if (completedDays.length) return Math.max(...completedDays);

  return 1;
}

function reasonText(s: DayState) {
  if (s.unlocked) return "열림";
  if (s.reason === "need-prev-complete") return "전날 완료 필요";
  if (s.reason === "wait-next-morning") return "내일 아침 오픈";
  return "날짜가 아직";
}

function badge(s: DayState) {
  if (s.completed) return "✓";
  if (s.unlocked) return "✅";
  return "🔒";
}

export function TrainSidebar(props: {
  progress: TrainProgress;
  selectedDay: number;
  onSelectDay: (day: number) => void;
}) {
  const { progress, selectedDay, onSelectDay } = props;

  const days = React.useMemo(() => computeDayStates(progress), [progress]);

  const openCount = days.filter((d) => d.completed).length;

  return (
    <aside className="h-full w-full border-r border-dojo-purple-muted bg-white">
      <div className="px-4 py-4 border-b border-dojo-purple-muted">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-dojo-purple-dark">28일 트랙</div>
            <div className="text-xs text-dojo-ink-soft mt-1">
              진행: <span className="font-medium">{openCount}</span> / {TOTAL_DAYS}
            </div>
          </div>
          <div className="text-xs text-dojo-ink-soft text-right">
            시작일<br />
            <span className="font-medium">{progress.startDateISO}</span>
          </div>
        </div>

        <div className="mt-3 text-[12px] text-dojo-ink-soft leading-relaxed">
          규칙: <span className="font-medium">전날 완료</span> + <span className="font-medium">다음날 아침 {OPEN_HOUR}시</span> 이후에 다음 Day가 열려요.
        </div>
      </div>

      <nav className="p-2 overflow-auto" aria-label="Train days">
        <ul className="space-y-1">
          {days.map((s) => {
            const isSelected = s.day === selectedDay;

            const helper =
              !s.unlocked && s.reason === "wait-next-morning" && s.unlockAtISO
                ? `오픈: ${fmtLocal(s.unlockAtISO)}`
                : !s.unlocked && s.reason === "need-prev-complete"
                ? "전날을 완료하면 열려요"
                : !s.unlocked && s.reason === "too-early"
                ? "날짜가 되면 열려요"
                : " ";

            return (
              <li key={s.day}>
                <button
                  type="button"
                  disabled={!s.unlocked}
                  onClick={() => s.unlocked && onSelectDay(s.day)}
                  className={cn(
                    "w-full text-left rounded-xl px-3 py-2 border transition",
                    "flex items-start gap-3",
                    s.unlocked
                      ? "border-dojo-purple-muted hover:border-dojo-purple/40 hover:bg-dojo-purple/5"
                      : "border-dojo-purple-muted/70 bg-gray-50 text-dojo-ink-soft cursor-not-allowed opacity-80",
                    isSelected && "border-dojo-purple/50 bg-dojo-purple/10"
                  )}
                >
                  <div className="mt-[2px] w-6 text-center text-sm">{badge(s)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className={cn("text-sm font-medium", s.unlocked ? "text-dojo-purple-dark" : "text-dojo-ink-soft")}>
                        Day {s.day}
                      </div>
                      <div className="text-[11px] text-dojo-ink-soft">
                        {s.completed ? "완료" : s.unlocked ? "오늘" : reasonText(s)}
                      </div>
                    </div>

                    <div className="text-[11px] text-dojo-ink-soft mt-1 truncate">{helper}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
