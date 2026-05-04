"use client";

import React from "react";
import type { UserPatternSignaturePublic } from "@/lib/bty/arena/patternSignature.types";
import type { PatternSignatureAggregateState } from "@/domain/arena/patternSignatureAggregation";
import type { PatternShiftBand } from "@/domain/leadership-engine/patternShift";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = {
  locale: string;
  rows: UserPatternSignaturePublic[] | undefined;
  title: string;
  lead: string;
  empty: string;
  regionAria: string;
};

function fmtIso(iso: string, locale: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString(locale === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function stateBadgeClass(state: PatternSignatureAggregateState): string {
  switch (state) {
    case "resolved":
      return "border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-400/40 dark:bg-cyan-500/15 dark:text-cyan-100/90";
    case "improving":
      return "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-400/35 dark:bg-sky-500/12 dark:text-sky-100/88";
    case "unstable":
      return "border-gray-300 bg-gray-100 text-gray-700 dark:border-white/20 dark:bg-white/[0.08] dark:text-white/75";
    case "active":
    default:
      return "border-gray-300 bg-gray-50 text-gray-700 dark:border-white/15 dark:bg-white/[0.06] dark:text-white/80";
  }
}

function shiftLabel(v: PatternShiftBand, lang: Locale): string {
  const m = getMessages(lang).myPageStub;
  if (v === "changed") return m.patternSignatureShiftChanged;
  if (v === "no_change") return m.patternSignatureShiftNoChange;
  if (v === "unstable") return m.patternSignatureShiftUnstable;
  return v;
}

/**
 * Arena pattern signatures — signal-forward read model (API-fed only).
 */
export function PatternSignaturePanel({ locale, rows, title, lead, empty, regionAria }: Props) {
  const lang: Locale = locale === "ko" ? "ko" : "en";
  const lt = getMessages(lang).myPageStub;
  const list = rows ?? [];

  if (list.length === 0) {
    return (
      <div
        className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60"
        role="region"
        aria-label={regionAria}
      >
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-white/45">{title}</h3>
        <p className="mt-1 m-0 text-xs leading-relaxed text-gray-600 dark:text-white/50">{empty}</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]"
      role="region"
      aria-label={regionAria}
    >
      <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-white/45">{title}</h3>
      <p className="mt-1 mb-4 m-0 text-xs leading-relaxed text-gray-600 dark:text-white/55">{lead}</p>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {list.map((r) => {
          const conf = Math.max(0, Math.min(1, r.confidence_score));
          const pct = Math.round(conf * 100);
          const highlight = r.current_state === "improving" || r.current_state === "resolved";
          return (
            <li
              key={`${r.pattern_family}:${r.axis}`}
              className={`rounded-xl border px-3 py-3 ${
                highlight
                  ? "border-cyan-300 bg-gradient-to-br from-cyan-50 to-transparent dark:border-cyan-400/20 dark:from-cyan-500/[0.06]"
                  : "border-gray-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-mono text-[12px] font-medium text-cyan-800 dark:text-cyan-200/95">{r.pattern_family}</p>
                  <p className="mt-0.5 m-0 text-[11px] text-gray-600 dark:text-white/55">{r.axis}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stateBadgeClass(r.current_state)}`}
                >
                  {r.current_state}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="m-0 text-[10px] uppercase tracking-wide text-gray-500 dark:text-white/40">{lt.patternSignatureRepeat}</p>
                  <p className="mt-0.5 m-0 text-lg font-semibold tabular-nums text-gray-900 dark:text-white/90">{r.repeat_count}</p>
                </div>
                <div>
                  <p className="m-0 text-[10px] uppercase tracking-wide text-gray-500 dark:text-white/40">{lt.patternSignatureLastShift}</p>
                  <p className="mt-0.5 m-0 text-xs font-medium text-gray-800 dark:text-white/80">{shiftLabel(r.last_validation_result, lang)}</p>
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <p className="m-0 text-[10px] uppercase tracking-wide text-gray-500 dark:text-white/40">{lt.patternSignatureConfidence}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
                      role="presentation"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full bg-cyan-500 transition-[width] dark:bg-cyan-400/55"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-gray-700 dark:text-white/70">{pct}%</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-200 pt-2 text-[10px] text-gray-500 dark:border-white/[0.06] dark:text-white/45">
                <span>
                  {lt.patternSignatureWatch}:{" "}
                  {r.next_watchpoint ? fmtIso(r.next_watchpoint, locale) : "—"}
                </span>
                <span>
                  {lt.patternSignatureSeen}: {fmtIso(r.last_seen_at, locale)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
