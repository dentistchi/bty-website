"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { userDayKey } from "@/domain/daily/userDayKey";

/**
 * Center — Personal Reality Feed (Slice 3.1B-3J). The CANONICAL Center first screen: the learner's
 * own Private Reflections rendered DIRECTLY (no separate subview), grouped TODAY / YESTERDAY /
 * EARLIER on the same 05:00 BTY-day boundary Today uses. Reuses the owner-scoped GET
 * /api/bty/foundry/history. Read-only V1. Also hosts the canonical consent toggle. Explicit DTO
 * allow-list — never the raw row. response_text is the learner's OWN and never Host-visible.
 */

type Locale = "en" | "ko";

type Entry = {
  entryId: string;
  eventTitle: string;
  contentType: "youtube" | "document";
  completedAt: string;
  responseText: string;
  /**
   * The learner's answer to the journey's REFLECT question (Slice 3.2R-R8D-R1) — what already
   * happens. null on every entry whose event never asked one. NEVER the same thing as
   * `responseText`, which is what they said they WILL do.
   */
  learnerReflection: string | null;
};

const COPY: Record<Locale, {
  title: string;
  subtitle: string;
  privacy: string;
  reflectLabel: string;
  beforeYouFinishLabel: string;
  consentLabel: string;
  consentHelp: string;
  consentPrivacy: string;
  today: string;
  yesterday: string;
  earlier: string;
  completedOn: string;
  video: string;
  document: string;
  empty: string;
  emptyHint: string;
  loading: string;
}> = {
  en: {
    title: "CENTER",
    subtitle: "A place to see yourself clearly.",
    privacy: "Your reflections are private. Only you can see them.",
    reflectLabel: "REFLECT",
    beforeYouFinishLabel: "BEFORE YOU FINISH",
    consentLabel: "Today personalization",
    consentHelp: "Use yesterday's private reflections for a short Today brief.",
    consentPrivacy: "Your reflection remains private and is never shown to the training Host.",
    today: "TODAY",
    yesterday: "YESTERDAY",
    earlier: "EARLIER",
    completedOn: "Completed",
    video: "Video",
    document: "PDF",
    empty: "No reflections yet.",
    emptyHint: "When you finish a training and write a private reflection, it appears here.",
    loading: "Loading…",
  },
  ko: {
    title: "CENTER",
    subtitle: "나를 선명하게 바라보는 공간.",
    privacy: "나의 성찰은 비공개이며 본인만 볼 수 있습니다.",
    reflectLabel: "성찰",
    beforeYouFinishLabel: "마치기 전에",
    consentLabel: "Today 개인화",
    consentHelp: "어제의 비공개 성찰을 바탕으로 짧은 Today 안내를 만듭니다.",
    consentPrivacy: "성찰 원문은 비공개이며 교육 담당자에게 공개되지 않습니다.",
    today: "오늘",
    yesterday: "어제",
    earlier: "이전",
    completedOn: "완료",
    video: "영상",
    document: "PDF",
    empty: "아직 성찰이 없습니다.",
    emptyHint: "교육을 마치고 비공개 성찰을 남기면 여기에서 볼 수 있습니다.",
    loading: "불러오는 중…",
  },
};

function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
function prevKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
function formatDate(iso: string, loc: Locale): string {
  try {
    return new Date(iso).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

function EntryCard({ it, t, loc, focused, refCb }: { it: Entry; t: (typeof COPY)["en"]; loc: Locale; focused: boolean; refCb: (el: HTMLLIElement | null) => void }) {
  return (
    <li
      ref={focused ? refCb : undefined}
      data-testid="center-reflection-item"
      data-entry-id={it.entryId}
      data-focused={focused ? "1" : undefined}
      className={"flex flex-col gap-2 rounded-2xl border bg-white/[0.03] px-4 py-3 " + (focused ? "border-[#C9A66B]/60 ring-1 ring-[#C9A66B]/40" : "border-white/8")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[0.95rem] font-medium text-white/90">{it.eventTitle}</span>
        <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-[0.7rem] uppercase tracking-wide text-white/55">
          {it.contentType === "document" ? t.document : t.video}
        </span>
      </div>
      <span className="text-xs text-white/45">{t.completedOn} · {formatDate(it.completedAt, loc)}</span>
      {/*
        ONE BLOCK OR TWO, DECIDED BY WHAT THE EVENT ACTUALLY ASKED (Slice 3.2R-R8D-R1).

        An R8B event asks two private questions — what already happens (REFLECT) and what the
        learner will say (BEFORE YOU FINISH) — and both answers are the learner's own. Showing
        them under one heading, or worse showing only the second as this card did, tells the
        learner they wrote one thing when they wrote two.

        A legacy entry asked ONE question, so it keeps exactly the presentation it has always
        had: the bare text, unlabelled. Labels appear only when there is something to tell
        apart, which is also why no historical answer is relabelled as a REFLECT it never was.
      */}
      {it.learnerReflection ? (
        <>
          <div className="mt-1 flex flex-col gap-1" data-testid="center-entry-reflect">
            <span className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-[#C9A66B]/85">{t.reflectLabel}</span>
            <p className="whitespace-pre-wrap text-sm leading-6 text-white/85">{it.learnerReflection}</p>
          </div>
          {it.responseText ? (
            <div className="mt-2 flex flex-col gap-1" data-testid="center-entry-before-you-finish">
              <span className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-[#C9A66B]/85">{t.beforeYouFinishLabel}</span>
              <p className="whitespace-pre-wrap text-sm leading-6 text-white/85">{it.responseText}</p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/85" data-testid="center-entry-legacy">{it.responseText}</p>
      )}
    </li>
  );
}

export default function CenterRealityFeed({ locale, focusEntryId = null }: { locale: string; focusEntryId?: string | null }) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [items, setItems] = useState<Entry[] | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [savingConsent, setSavingConsent] = useState(false);
  const focusRef = useRef<HTMLLIElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/foundry/history", { credentials: "include", cache: "no-store" });
      if (!res.ok) return setItems([]);
      const data = (await res.json()) as { history?: Array<{ entryId?: string; eventTitle?: string; contentType?: string; completedAt?: string; responseText?: string; learnerReflection?: string | null }> };
      setItems(
        (data?.history ?? [])
          .map((h): Entry => ({
            entryId: String(h.entryId ?? ""),
            eventTitle: String(h.eventTitle ?? "Foundry training"),
            contentType: h.contentType === "document" ? "document" : "youtube",
            completedAt: String(h.completedAt ?? ""),
            responseText: String(h.responseText ?? ""),
            learnerReflection: h.learnerReflection ? String(h.learnerReflection) : null,
          }))
          /*
            ELIGIBLE = the learner wrote at least one private answer Center may show.

            This was `responseText.length > 0`, which was correct while that was the only private
            answer there was. After R8B an entry can carry a REFLECT answer and no completion
            text, and that entry would have vanished from the one surface built to show it. Still
            deliberately narrow: an entry with neither is nothing to read and stays out.
          */
          .filter((e) => e.responseText.length > 0 || (e.learnerReflection?.length ?? 0) > 0),
      );
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
    void (async () => {
      try {
        const res = await fetch("/api/me/conversation-preferences", { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as { personalizeTodayFromReflections?: boolean };
          setConsent(d?.personalizeTodayFromReflections === true);
        } else setConsent(false);
      } catch {
        setConsent(false);
      }
    })();
  }, [load]);

  useEffect(() => {
    if (!focusEntryId || !items) return;
    const el = focusRef.current;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
  }, [focusEntryId, items]);

  const toggleConsent = useCallback(async () => {
    if (savingConsent || consent === null) return;
    const next = !consent;
    setSavingConsent(true);
    setConsent(next); // optimistic
    try {
      const res = await fetch("/api/me/conversation-preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personalizeTodayFromReflections: next }),
      });
      if (!res.ok) setConsent(!next); // revert on failure
    } catch {
      setConsent(!next);
    } finally {
      setSavingConsent(false);
    }
  }, [consent, savingConsent]);

  // Group on the same 05:00 BTY-day boundary Today uses (device tz).
  const tz = deviceTz();
  const now = new Date();
  const todayKey = userDayKey(now, tz, 5);
  const yKey = prevKey(todayKey);
  const groups: { key: "today" | "yesterday" | "earlier"; label: string; rows: Entry[] }[] = [
    { key: "today", label: t.today, rows: [] },
    { key: "yesterday", label: t.yesterday, rows: [] },
    { key: "earlier", label: t.earlier, rows: [] },
  ];
  for (const it of items ?? []) {
    const k = userDayKey(new Date(it.completedAt), tz, 5);
    (k === todayKey ? groups[0] : k === yKey ? groups[1] : groups[2]).rows.push(it);
  }

  return (
    <section data-testid="center-reality-feed" className="flex flex-col gap-5 px-4 py-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C9A66B]/85">{t.title}</span>
        <p className="text-[0.95rem] text-white/70">{t.subtitle}</p>
        <p className="mt-1 text-xs text-white/45">{t.privacy}</p>
      </div>

      {/* Compact personalization setting (Slice 3.1B-3J.1) — a supporting setting ROW, not a
          dominant card: a top divider instead of a filled box, so it never overpowers the feed.
          The whole row is one accessible switch button (tapping the label toggles too), avoiding a
          <label>-wraps-<button> double-fire. Fixed-PX track + thumb pinned with left/top: the thumb
          can never leave the track — no rem-scaling drift (px is immune to iOS Dynamic Type), no
          missing left anchor, and `shrink-0` stops the control compressing in the flex row. */}
      <div className="flex flex-col gap-1.5 border-t border-white/8 pt-4">
        <button
          type="button"
          role="switch"
          aria-checked={consent === true}
          aria-label={t.consentLabel}
          aria-busy={savingConsent || undefined}
          data-testid="center-consent-toggle"
          disabled={consent === null || savingConsent}
          onClick={toggleConsent}
          className="flex w-full items-center justify-between gap-4 text-left transition-opacity disabled:opacity-60"
        >
          <span className="min-w-0 text-sm text-white/80">{t.consentLabel}</span>
          <span
            aria-hidden
            data-testid="center-consent-track"
            className={
              "relative inline-block h-[24px] w-[44px] shrink-0 rounded-full transition-colors duration-200 " +
              (consent ? "bg-[#C9A66B]" : "bg-white/20")
            }
          >
            <span
              data-testid="center-consent-thumb"
              className={
                "absolute top-[2px] left-[2px] h-[20px] w-[20px] rounded-full bg-white shadow-sm transition-transform duration-200 " +
                (consent ? "translate-x-[20px]" : "translate-x-0")
              }
            />
          </span>
        </button>
        <p className="text-xs leading-5 text-white/45">{t.consentHelp}</p>
        <p className="text-[0.7rem] leading-5 text-white/35">{t.consentPrivacy}</p>
      </div>

      {items === null ? (
        <p className="text-sm text-white/40" role="status">{t.loading}</p>
      ) : items.length === 0 ? (
        <div data-testid="center-feed-empty" className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-6 text-center">
          <p className="text-sm text-white/70">{t.empty}</p>
          <p className="mt-1 text-xs text-white/45">{t.emptyHint}</p>
        </div>
      ) : (
        groups
          .filter((g) => g.rows.length > 0)
          .map((g) => (
            <div key={g.key} data-testid={`center-group-${g.key}`} className="flex flex-col gap-3">
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/40">{g.label}</span>
              <ul className="flex flex-col gap-3">
                {g.rows.map((it) => (
                  <EntryCard key={it.entryId} it={it} t={t} loc={loc} focused={!!focusEntryId && it.entryId === focusEntryId} refCb={(el) => (focusRef.current = el)} />
                ))}
              </ul>
            </div>
          ))
      )}
    </section>
  );
}
