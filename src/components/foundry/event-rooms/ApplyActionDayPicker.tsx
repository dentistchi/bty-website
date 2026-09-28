"use client";

import { useState } from "react";
import { APPLY_ACTION_PICK_OFFSETS } from "@/domain/foundry/apply-window/applyWindow";

/**
 * APPLY ACTION DAY V1 — "When will you do it?" beside the Action Decision. DAY precision only.
 *
 * It emits a wire TOKEN, never a date: "today" | "tomorrow" | "pick:N" | "this_week", or null
 * when nothing is chosen. The server anchors the token to the learner's completion BTY day in
 * their canonical timezone, so neither the browser clock nor the device timezone ever decides
 * the stored day. "Pick a day" therefore offers "In N days" rather than calendar dates the
 * client cannot know.
 *
 * Optional by design: leaving it unset, or choosing "Sometime this week", keeps the existing
 * 7-day window.
 */
export type ApplyActionToken = string | null;

const COPY = {
  en: {
    ask: "When will you do it?",
    today: "Today",
    tomorrow: "Tomorrow",
    pick: "Pick a day",
    thisWeek: "Sometime this week",
    inDays: (n: number) => `In ${n} days`,
  },
  ko: {
    ask: "언제 하시겠습니까?",
    today: "오늘",
    tomorrow: "내일",
    pick: "날짜 선택",
    thisWeek: "이번 주 중",
    inDays: (n: number) => `${n}일 후`,
  },
} as const;

const chip = (selected: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs transition-colors ${
    selected
      ? "border-[#C9A66B] bg-[#C9A66B]/20 text-white"
      : "border-white/20 bg-white/5 text-white/75 hover:bg-white/10"
  }`;

export default function ApplyActionDayPicker({
  locale,
  value,
  onChange,
  disabled = false,
}: {
  locale: "en" | "ko";
  value: ApplyActionToken;
  onChange: (next: ApplyActionToken) => void;
  disabled?: boolean;
}) {
  const t = COPY[locale];
  const picking = typeof value === "string" && value.startsWith("pick:");
  const [pickOpen, setPickOpen] = useState(picking);
  const select = (token: ApplyActionToken) => {
    setPickOpen(false);
    onChange(value === token ? null : token);
  };

  return (
    <div className="mt-3" data-testid="apply-action-day">
      <p className="text-sm font-medium leading-6 text-white/90">{t.ask}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t.ask}>
        <button type="button" disabled={disabled} aria-pressed={value === "today"} data-testid="apply-action-today"
          className={chip(value === "today")} onClick={() => select("today")}>{t.today}</button>
        <button type="button" disabled={disabled} aria-pressed={value === "tomorrow"} data-testid="apply-action-tomorrow"
          className={chip(value === "tomorrow")} onClick={() => select("tomorrow")}>{t.tomorrow}</button>
        <button type="button" disabled={disabled} aria-pressed={pickOpen || picking} data-testid="apply-action-pick"
          className={chip(pickOpen || picking)} onClick={() => { setPickOpen((o) => !o); if (picking) onChange(null); }}>{t.pick}</button>
        <button type="button" disabled={disabled} aria-pressed={value === "this_week"} data-testid="apply-action-this-week"
          className={chip(value === "this_week")} onClick={() => select("this_week")}>{t.thisWeek}</button>
      </div>
      {pickOpen || picking ? (
        <div className="mt-2 flex flex-wrap gap-2" data-testid="apply-action-pick-days">
          {APPLY_ACTION_PICK_OFFSETS.map((n) => {
            const token = `pick:${n}`;
            return (
              <button key={token} type="button" disabled={disabled} aria-pressed={value === token}
                data-testid={`apply-action-${token}`} className={chip(value === token)}
                onClick={() => onChange(value === token ? null : token)}>{t.inDays(n)}</button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
