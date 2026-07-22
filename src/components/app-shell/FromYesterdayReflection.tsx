"use client";

import { useEffect, useState } from "react";

/**
 * Today — "From yesterday" private reflection card (Slice 3.1B-3I).
 *
 * A private bridge from yesterday into today. Owner-only: reads the owner-scoped
 * GET /api/me/today/yesterday-reflection?tz=<deviceTz> (server computes "yesterday" on the
 * canonical BTY day boundary in the learner's tz). NO AI — it shows only the learner's OWN text,
 * and ONLY after the learner taps "View reflection" (collapsed by default; expansion is local/
 * session-only). Renders NOTHING when there is no eligible yesterday reflection (no guilt card).
 * Never in Host surfaces; never in push. Links to the exact Center entry.
 */

type Locale = "en" | "ko";

type Payload = {
  entryId: string;
  eventTitle: string;
  contentType: "youtube" | "document";
  completedAt: string;
  responseText: string;
  additionalCount: number;
};

const COPY: Record<Locale, {
  eyebrow: string;
  lead: string;
  view: string;
  hide: string;
  viewInCenter: string;
  more: (n: number) => string;
  dismiss: string;
}> = {
  en: {
    eyebrow: "FROM YESTERDAY",
    lead: "You left a private reflection yesterday.",
    view: "View reflection",
    hide: "Hide",
    viewInCenter: "View in Center",
    more: (n) => `${n} more reflection${n === 1 ? "" : "s"}`,
    dismiss: "Dismiss",
  },
  ko: {
    eyebrow: "어제의 나",
    lead: "어제 비공개 성찰을 남겼습니다.",
    view: "성찰 보기",
    hide: "숨기기",
    viewInCenter: "Center에서 보기",
    more: (n) => `성찰 ${n}개 더 보기`,
    dismiss: "닫기",
  },
};

export default function FromYesterdayReflection({ locale }: { locale: string }) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [data, setData] = useState<Payload | null>(null);
  const [expanded, setExpanded] = useState(false); // local/session-only — no persistence
  const [dismissed, setDismissed] = useState(false); // local session dismissal — no preference table

  useEffect(() => {
    let cancelled = false;
    let tz: string | null = null;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      tz = null;
    }
    void (async () => {
      try {
        const res = await fetch(`/api/me/today/yesterday-reflection${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { ok?: boolean; reflection?: Payload | null };
        if (!cancelled && json?.ok && json.reflection) setData(json.reflection);
      } catch {
        /* fail-soft — render nothing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // No eligible reflection, or the learner dismissed it this session → render nothing.
  if (!data || dismissed) return null;

  const centerHref = `/${loc}/app?tab=center&view=reflections&entry=${encodeURIComponent(data.entryId)}`;

  return (
    <section
      data-testid="from-yesterday-reflection"
      className="flex flex-col gap-2 rounded-2xl border border-[#C9A66B]/22 bg-[#C9A66B]/[0.05] px-4 py-3"
      aria-label={t.eyebrow}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#C9A66B]/85">{t.eyebrow}</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          data-testid="from-yesterday-dismiss"
          aria-label={t.dismiss}
          className="text-xs text-white/35 hover:text-white/60"
        >
          ✕
        </button>
      </div>
      <p className="text-sm leading-6 text-white/80">{t.lead}</p>
      <span className="truncate text-xs text-white/45">{data.eventTitle}</span>

      {/* Collapsed by default — the raw reflection appears ONLY after the learner taps. */}
      {expanded ? (
        <p data-testid="from-yesterday-body" className="mt-1 whitespace-pre-wrap rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm leading-6 text-white/85">
          {data.responseText}
        </p>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            data-testid="from-yesterday-view"
            className="text-sm font-medium text-[#C9A66B]"
          >
            {t.view}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-sm text-white/50"
          >
            {t.hide}
          </button>
        )}
        {data.additionalCount > 0 ? (
          <a href={centerHref} data-testid="from-yesterday-more" className="text-sm text-white/55 underline underline-offset-4">
            {t.more(data.additionalCount)}
          </a>
        ) : null}
        <a href={centerHref} data-testid="from-yesterday-center" className="text-sm text-[#C9A66B]/80 underline underline-offset-4">
          {t.viewInCenter} →
        </a>
      </div>
    </section>
  );
}
