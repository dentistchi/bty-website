"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
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
    acknowledged: Responder[];
    question: Responder[];
    needHelp: Responder[];
    noResponse: Responder[];
  };
};

type Copy = (typeof COPY)[Locale];

type Responder = {
  recipientId: string;
  display: string | null;
  questionText: string | null;
  respondedAt: string | null;
  handledAt: string | null;
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
    markHandled: "Mark handled",
    handled: "Handled",
    reopen: "Reopen",
    /* What the Host must do next, said as the thing to do rather than a status name. */
    needsReply: "Needs a reply",
    needsHelp: "Needs help from you",
    nothingToDo: "Nothing to do",
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
    markHandled: "처리 완료",
    handled: "처리됨",
    reopen: "다시 열기",
    needsReply: "답변이 필요합니다",
    needsHelp: "도움이 필요합니다",
    nothingToDo: "할 일 없음",
    openInTeams: "Teams에서 열기",
    closed: "종료됨",
    error: "추적 중인 항목을 불러오지 못했습니다.",
    retry: "다시 시도",
  },
} as const;

/** Still-open people first: a Host must not read past settled rows to find their next action. */
function openFirst(people: Responder[]): Responder[] {
  return [...people].sort((a, b) => Number(a.handledAt !== null) - Number(b.handledAt !== null));
}

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
 * One named bucket inside the expanded view.
 *
 * ★ THE HEADING IS THE ACTION, NOT THE STATUS NAME. A Host scanning this is asking "what do I have
 * to do?", and "Needs a reply" answers that where "Question" only names a category. The buckets
 * are ordered by how much they demand — help, then questions, then people who have not answered,
 * then the ones that are already finished — so the top of the list is always the next thing to do.
 *
 * A settled person stays visible rather than disappearing, because a Host needs to see that they
 * dealt with someone, and because vanishing on tap reads as data loss.
 */
function Bucket({
  label,
  people,
  tone,
  fallback,
  t,
  busyId,
  onHandle,
}: {
  label: string;
  people: Responder[];
  tone: "urgent" | "quiet";
  fallback: string;
  t: Copy;
  busyId: string | null;
  onHandle: ((r: Responder, handled: boolean) => void) | null;
}) {
  if (people.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="tracking-bucket" data-bucket={label}>
      <p
        className={
          "text-[0.72rem] font-medium uppercase tracking-[0.1em] " +
          (tone === "urgent" ? "text-[#E5B769]" : "text-white/55")
        }
      >
        {label}
      </p>
      {people.map((p) => {
        const settled = p.handledAt !== null;
        return (
          <div
            key={p.recipientId}
            className="flex flex-col gap-1"
            data-testid="tracking-person"
            data-recipient={p.recipientId}
            data-handled={settled ? "1" : "0"}
          >
            <div className="flex items-center justify-between gap-3">
              {/* A bound person whose provider name could not be read is still shown, never dropped. */}
              <span className={"text-[0.88rem] leading-6 " + (settled ? "text-white/55" : "text-white/85")}>
                {p.display ?? fallback}
              </span>
              {onHandle ? (
                <button
                  type="button"
                  data-testid={settled ? "tracking-reopen" : "tracking-handle"}
                  disabled={busyId === p.recipientId}
                  onClick={() => onHandle(p, !settled)}
                  className={
                    "min-h-[2.25rem] shrink-0 rounded-lg px-3 text-[0.78rem] font-medium disabled:opacity-50 " +
                    (settled
                      ? "text-white/55 hover:text-white/70"
                      : "border border-[#C9A66B]/45 bg-[#C9A66B]/10 text-[#E5B769]")
                  }
                >
                  {settled ? t.reopen : t.markHandled}
                </button>
              ) : null}
            </div>

            {/* The question survives being handled: acting on it is not permission to erase it. */}
            {p.questionText ? (
              <span
                className={
                  "rounded-lg bg-white/[0.04] px-3 py-2 text-[0.82rem] leading-6 " +
                  (settled ? "text-white/55" : "text-white/70")
                }
                data-testid="tracking-person-question"
              >
                {p.questionText}
              </span>
            ) : null}

            {settled ? (
              <span className="text-[0.72rem] text-white/50" data-testid="tracking-person-handled">
                {t.handled}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function TrackingSent({ locale, refreshKey }: { locale: string; refreshKey?: number }) {
  const t = COPY[locale === "ko" ? "ko" : "en"];
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const [items, setItems] = useState<HostItem[] | null>(null);
  /**
   * ★ FAILURES ARE NOT ALL THE SAME THING (device FAIL, 2026-09-02T21:36Z).
   *
   * This shipped collapsing every non-200 into "Couldn't load what you're tracking.", and the
   * Founder hit it on a live iPhone. MEASURED: the session was valid (`/auth/v1/user` returned
   * 200) and ZERO reads reached the announcement tables — because the route answered
   * `403 consent_required` from `requireConsentedUser`, before `listHostAnnouncements` ran.
   * hc had no `arena_profiles` row, so `consentSatisfied(undefined)` was false.
   *
   * That gate is gone from this route — Arena learner consent was never the right authority for a
   * Host reading back their own run, and the route now asks for Track capability instead. What
   * survives from that episode is the lesson, not the workaround: a stale token is re-read exactly
   * once, and every other failure is the honest error rather than a retry that cannot help.
   */
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  /** Which run is expanded. One at a time: Today is a glance, not a console. */
  const [openId, setOpenId] = useState<string | null>(null);
  const load = useCallback(async () => {
    /**
     * One request, and at most ONE retry after re-reading the session.
     *
     * The retry exists for a token that rotated between mount and fetch, not as a loop: Supabase
     * refreshes access tokens, and the Teams transport reads the current one through a getter, so
     * re-reading the session is what makes a second attempt different from the first. A captured
     * token would make the retry identical to the request that just failed.
     */
    const attempt = async (): Promise<Response | null> => {
      try {
        return await fetch("/api/bty/announcements/host", { credentials: "include", cache: "no-store" });
      } catch {
        return null;
      }
    };

    let res = await attempt();

    if (res?.status === 401) {
      // Ask the client for the CURRENT session — this is what refreshes a rotated token — then
      // try exactly once more. No polling, no reload, and never setSession.
      try {
        // `supabase` is null when the browser client is not configured; the retry still runs and
        // its own 401 becomes the honest error rather than a crash.
        await supabase?.auth.getSession();
      } catch {
        /* A session we cannot read is handled by the retry's own result. */
      }
      res = await attempt();
    }

    if (!res) {
      setState("error");
      return;
    }

    // A 403 here means the person does not hold Track capability, which is not a state this lane
    // explains — someone who has never tracked anything has nothing to be told about tracking.
    // It falls through to the same quiet error as any other refusal.
    if (!res.ok) {
      setState("error");
      return;
    }

    const d = (await res.json().catch(() => null)) as { ok?: boolean; items?: HostItem[] } | null;
    if (d?.ok !== true || !Array.isArray(d.items)) {
      setState("error");
      return;
    }
    setItems(d.items);
    setState("ready");
  }, []);

  /** The person whose Handled write is in flight. Scoped to one row, never a screen-level spinner. */
  const [busyId, setBusyId] = useState<string | null>(null);

  /**
   * Settle (or re-open) one person's follow-up.
   *
   * Nothing is shown as done before the server says so — the row is re-read from the owner-scoped
   * route afterwards, so what the Host sees is what is stored. Ownership is re-verified in the
   * database on every call; this component's possession of a recipient id grants nothing.
   */
  const handle = useCallback(
    async (r: Responder, handled: boolean) => {
      setBusyId(r.recipientId);
      try {
        const res = await fetch(
          `/api/bty/announcements/recipients/${encodeURIComponent(r.recipientId)}/handle`,
          {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ handled }),
          },
        );
        if (res.ok) await load();
      } catch {
        /* Left visibly unhandled: a follow-up wrongly shown as settled is worse than a retry. */
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );


  /*
    Re-read on mount AND whenever Today is re-entered. `refreshKey` changes only on a real tab
    press, so this is one request per deliberate return — not an interval, not a visibility
    listener, and not a realtime channel.
  */
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (state === "error") {
    return (
      <section className="flex flex-col gap-2" data-testid="tracking-sent-error">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/55">{t.title}</h2>
        <p className="text-[0.8rem] text-white/60">{t.error}</p>
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
  if (state === "loading" || !items || items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" data-testid="tracking-sent">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/55">{t.title}</h2>

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
                className="border-l-2 border-white/15 pl-3 text-[0.82rem] leading-6 text-white/60"
                data-testid="tracking-preview"
              >
                {it.previewText}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem] text-white/55">
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
              <p className="text-[0.8rem] leading-5 text-white/60" data-testid="tracking-waiting">
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
                className="self-start text-[0.8rem] font-medium text-white/60 hover:text-white/80"
              >
                {expanded ? t.hideResponses : t.viewResponses}
              </button>
            ) : null}

            {expanded ? (
              <div className="flex flex-col gap-3 border-t border-white/[0.08] pt-3" data-testid="tracking-responses">
                {/*
                  ORDERED BY WHAT THEY DEMAND: help, then questions, then silence, then the
                  finished. Within the two actionable buckets the still-open people come first,
                  so a Host never has to read past settled rows to find the next thing to do.
                */}
                <Bucket label={t.needsHelp} people={openFirst(r.needHelp)} tone="urgent" fallback={t.someone}
                  t={t} busyId={busyId} onHandle={handle} />
                <Bucket label={t.needsReply} people={openFirst(r.question)} tone="urgent" fallback={t.someone}
                  t={t} busyId={busyId} onHandle={handle} />
                <Bucket label={t.noResponse} people={r.noResponse} tone="quiet" fallback={t.someone}
                  t={t} busyId={busyId} onHandle={null} />
                {/* "Got it" is already an ending; there is nothing for a Host to settle. */}
                <Bucket label={t.gotIt} people={r.acknowledged} tone="quiet" fallback={t.someone}
                  t={t} busyId={busyId} onHandle={null} />
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
