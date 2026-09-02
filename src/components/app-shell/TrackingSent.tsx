"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnnouncementFunnel } from "@/domain/announcement/trackedAnnouncement";
import { funnelIsComplete } from "@/domain/announcement/trackedAnnouncement";

/**
 * "Tracking" — what the Host asked for, and what came back. Today lane.
 *
 * ★ THE GAP THIS CLOSES, MEASURED (2026-09-02). A real Track succeeded in Teams — announcement
 * `6cfccb92…`, one recipient, written correctly — and the Host could not find it anywhere in BTY.
 * The service (`listHostAnnouncements`), the owner-scoped route (`/api/bty/announcements/host`)
 * and the five-bucket funnel all existed and were correct. **Nothing rendered them.** The route
 * had zero callers. A write with no follow-through is not a tracking feature, so this is the
 * missing surface rather than any new authority or schema.
 *
 * WHY IT IS SAFE TO RENDER WITHOUT A CAPABILITY CHECK. The route is owner-scoped by
 * `owner_user_id` = the session user, so a person who has never tracked anything gets `[]` and
 * this lane does not exist for them. Asking a second question ("are you a Host?") would add a
 * round trip and a second place to get authorization wrong, for the same visible result.
 *
 * WHAT A HOST IS NOT SHOWN. No recipient names, no directory ids, no percentage, no "engagement"
 * score. Five counts that add up, and a plain sentence for the one state people misread.
 */

type HostItem = {
  id: string;
  hostFraming: string;
  createdAt: string;
  previewText: string | null;
  sourceUrl: string | null;
  status: "active" | "closed";
  funnel: AnnouncementFunnel;
  responders: {
    acknowledged: { display: string | null }[];
    question: { display: string | null; questionText: string | null; respondedAt: string | null }[];
    needHelp: { display: string | null; respondedAt: string | null }[];
    noResponse: { display: string | null }[];
  };
};

type Locale = "en" | "ko";

const COPY = {
  en: {
    title: "Tracking",
    sentTo: (n: number) => (n === 1 ? "Sent to 1 person" : `Sent to ${n} people`),
    gotIt: "Acknowledged",
    question: "Question",
    needHelp: "Help needed",
    noResponse: "No response yet",
    /* The one state a Host will otherwise read as being ignored. Say what is actually true. */
    waiting: "Waiting for them to open BTY",
    /* Count wording, because the People Picker gives BTY an id and no name to show. */
    notOpened: (n: number) =>
      n === 1 ? "1 person hasn't opened BTY yet" : `${n} people haven't opened BTY yet`,
    viewResponses: "View responses",
    hideResponses: "Hide",
    someone: "Someone",
    openInTeams: "Open in Teams",
    closed: "Closed",
    error: "Couldn't load what you're tracking.",
    retry: "Retry",
  },
  ko: {
    title: "추적 중",
    sentTo: (n: number) => `${n}명에게 보냄`,
    gotIt: "확인함",
    question: "질문",
    needHelp: "도움 필요",
    noResponse: "아직 응답 없음",
    waiting: "BTY를 열기를 기다리는 중",
    notOpened: (n: number) => `${n}명이 아직 BTY를 열지 않았습니다`,
    viewResponses: "응답 보기",
    hideResponses: "접기",
    someone: "이름 없음",
    openInTeams: "Teams에서 열기",
    closed: "종료됨",
    error: "추적 중인 항목을 불러오지 못했습니다.",
    retry: "다시 시도",
  },
} as const;

/** Relative day, because a Host reads "today" and "yesterday" faster than a date. */
function whenLabel(iso: string, locale: Locale): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (locale === "ko") return days <= 0 ? "오늘" : days === 1 ? "어제" : `${days}일 전`;
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

/**
 * One count. Rendered ONLY when it is non-zero.
 *
 * A row of zeroes is noise a person has to read past to find the number that changed, and four
 * empty buckets make a run look like a failure when nobody has simply answered yet.
 */
function Count({ n, label, tone }: { n: number; label: string; tone: "gold" | "quiet" }) {
  if (n <= 0) return null;
  return (
    <span
      data-testid="tracking-count"
      data-label={label}
      data-count={n}
      className={
        "inline-flex items-baseline gap-1.5 rounded-lg px-2.5 py-1 text-[0.78rem] " +
        (tone === "gold" ? "bg-[#C9A66B]/[0.12] text-[#E5B769]" : "bg-white/[0.05] text-white/60")
      }
    >
      <span className="font-semibold tabular-nums">{n}</span>
      <span>{label}</span>
    </span>
  );
}

/**
 * One named bucket, shown only inside the expanded view.
 *
 * The status is the heading and the people are under it, because a Host is scanning for a STATE
 * first ("who needs help?") and only then for a person. A name with no status beside it would be
 * a list; a status with names under it is a next action.
 */
function Bucket({
  label,
  people,
  tone,
  fallback,
}: {
  label: string;
  people: { display: string | null; questionText?: string | null }[];
  tone: "gold" | "quiet";
  fallback: string;
}) {
  if (people.length === 0) return null;
  return (
    <div className="flex flex-col gap-1" data-testid="tracking-bucket" data-bucket={label}>
      <p
        className={
          "text-[0.72rem] font-medium uppercase tracking-[0.1em] " +
          (tone === "gold" ? "text-[#E5B769]" : "text-white/40")
        }
      >
        {label}
      </p>
      {people.map((p, i) => (
        <div key={i} className="flex flex-col gap-0.5" data-testid="tracking-person">
          {/* A bound person whose provider name could not be read is still shown, never dropped. */}
          <span className="text-[0.88rem] leading-6 text-white/80">{p.display ?? fallback}</span>
          {p.questionText ? (
            <span
              className="rounded-lg bg-white/[0.04] px-3 py-2 text-[0.82rem] leading-6 text-white/70"
              data-testid="tracking-person-question"
            >
              {p.questionText}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function TrackingSent({ locale }: { locale: string }) {
  const t = COPY[locale === "ko" ? "ko" : "en"];
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const [items, setItems] = useState<HostItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** Which run is expanded. One at a time: Today is a glance, not a console. */
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/announcements/host", { credentials: "include", cache: "no-store" });
      const d = (await res.json().catch(() => null)) as { ok?: boolean; items?: HostItem[] } | null;
      if (!res.ok || d?.ok !== true || !Array.isArray(d.items)) {
        setFailed(true);
        return;
      }
      setItems(d.items);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <section className="flex flex-col gap-2" data-testid="tracking-sent-error">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">{t.title}</h2>
        <p className="text-[0.8rem] text-white/55">{t.error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="self-start rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs text-white/70"
        >
          {t.retry}
        </button>
      </section>
    );
  }

  // Nothing tracked is not a state worth a card — the lane simply is not there.
  if (!items || items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" data-testid="tracking-sent">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">{t.title}</h2>

      {items.map((it) => {
        const f = it.funnel;
        const r = it.responders;
        // Only BOUND people can be named; an unactivated recipient is a count, never a row.
        const namedCount =
          r.acknowledged.length + r.question.length + r.needHelp.length + r.noResponse.length;
        const expanded = openId === it.id;
        return (
          <article
            key={it.id}
            data-testid="tracking-item"
            data-announcement={it.id}
            data-status={it.status}
            className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4"
          >
            {/* The Host's own words first: it is what they wrote and what they will recognise. */}
            <p className="text-[0.95rem] leading-6 text-white/85" data-testid="tracking-framing">
              {it.hostFraming}
            </p>

            {/* The captured message, quieter — context, not the headline. */}
            {it.previewText ? (
              <p
                className="border-l-2 border-white/15 pl-3 text-[0.82rem] leading-6 text-white/50"
                data-testid="tracking-preview"
              >
                {it.previewText}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem] text-white/45">
              <span data-testid="tracking-when">{whenLabel(it.createdAt, loc)}</span>
              <span aria-hidden>·</span>
              <span data-testid="tracking-sent-to">{t.sentTo(f.announcedTo)}</span>
              {it.status === "closed" ? (
                <>
                  <span aria-hidden>·</span>
                  <span data-testid="tracking-closed">{t.closed}</span>
                </>
              ) : null}
            </div>

            {/* Only the buckets that have someone in them. They always add up to announcedTo. */}
            <div className="flex flex-wrap gap-1.5" data-testid="tracking-funnel">
              <Count n={f.gotIt} label={t.gotIt} tone="gold" />
              <Count n={f.question} label={t.question} tone="gold" />
              <Count n={f.needHelp} label={t.needHelp} tone="gold" />
              <Count n={f.noResponse} label={t.noResponse} tone="quiet" />
            </div>

            {/*
              NOT SILENCE. Someone who has never opened BTY cannot answer, and counting them under
              "No response yet" would tell the Host they were ignored. The People Picker submits
              object ids only, so BTY has no name for these people and invents none — the count is
              the honest thing to say.
            */}
            {f.notYetActivated > 0 ? (
              <p className="text-[0.8rem] leading-5 text-white/55" data-testid="tracking-waiting">
                {t.notOpened(f.notYetActivated)}
              </p>
            ) : null}

            {/*
              ★ NAMES LIVE BEHIND ONE TAP, NOT IN THE RESTING CARD.

              A Host glancing at Today needs "did it land?", and the counts answer that in one
              line. "Who do I chase?" is a different, deliberate question — putting every name and
              status into the resting card would turn a glance into an admin table, on a phone.
              The control is only rendered when there is somebody to name.
            */}
            {namedCount > 0 ? (
              <button
                type="button"
                data-testid="tracking-toggle"
                aria-expanded={expanded}
                onClick={() => setOpenId(expanded ? null : it.id)}
                className="self-start text-[0.8rem] font-medium text-white/55 hover:text-white/80"
              >
                {expanded ? t.hideResponses : t.viewResponses}
              </button>
            ) : null}

            {expanded ? (
              <div className="flex flex-col gap-3 border-t border-white/[0.08] pt-3" data-testid="tracking-responses">
                <Bucket label={t.needHelp} people={r.needHelp} tone="gold" fallback={t.someone} />
                <Bucket label={t.question} people={r.question} tone="gold" fallback={t.someone} />
                <Bucket label={t.gotIt} people={r.acknowledged} tone="quiet" fallback={t.someone} />
                <Bucket label={t.noResponse} people={r.noResponse} tone="quiet" fallback={t.someone} />
              </div>
            ) : null}

            {it.sourceUrl ? (
              <a
                href={it.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="tracking-source-link"
                className="self-start text-[0.8rem] font-medium text-[#C9A66B]"
              >
                {t.openInTeams}
              </a>
            ) : null}

            {/*
              A funnel that does not account for every recipient is a bug the Host must not be
              shown as fact. Rendering nothing is honest; rendering a wrong total is not.
            */}
            {!funnelIsComplete(f) ? (
              <p className="sr-only" data-testid="tracking-funnel-incomplete">
                counts unavailable
              </p>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
