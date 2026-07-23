"use client";

import { useEffect, useState } from "react";

/**
 * Today — Personal Daily Brief (Slice 3.1B-3J). Deterministic reminders + an OPTIONAL, consent-
 * gated AI observation/suggestion, composed SERVER-SIDE (/api/me/today/brief). The raw Reflection
 * body NEVER reaches this client — only the generated sentences + reminder DTOs. Replaces the raw
 * "From yesterday" card. Renders nothing when there is neither a brief nor a reminder.
 *
 * Slice 3.1B-3L adds a SEPARATE "LEADERSHIP ATTENTION" section (Host obligations), rendered only for
 * a Host who owns events with attention items. It is read-only navigation — no review buttons here;
 * every row deep-links into the exact Event Control Room section/row. Learner obligations (DON'T MISS
 * TODAY) and people-review duties are never mixed. First 3 show, with an in-place "Show all N"
 * expansion (session-local presentation state only — NEVER a dismissal / viewed-once behavior).
 */

type Locale = "en" | "ko";

type Reminder = {
  stableId: string;
  category: "REQUIRED_LEARNING" | "ACTION_DUE" | "PRACTICE_DUE" | "FOLLOW_UP_DUE";
  title: string;
  state: "overdue" | "due_today" | "incomplete_required" | "upcoming";
  canonicalDeepLink: string;
};
type Brief = { yesterdayObservation: string; todaySuggestion: string };

type HostAttentionCategory = "FOLLOW_UP_OVERDUE" | "FOLLOW_UP_NEEDED" | "SHARED_REVIEW_DUE";
type HostAttention = {
  stableId: string;
  category: HostAttentionCategory;
  eventId: string;
  focusId: string;
  participantDisplayName: string;
  trainingTitle: string;
  reason: string;
  sourceTimestamp: string;
  deepLink: string;
};

const HOST_PREVIEW = 3;

const COPY: Record<Locale, {
  yesterday: string;
  today: string;
  dontMiss: string;
  overdue: string;
  dueToday: string;
  incomplete: string;
  upcoming: string;
  required: string;
  action: string;
  practice: string;
  leadershipTitle: string;
  leadershipSub: string;
  showAll: (n: number) => string;
  showLess: string;
  hostTags: Record<HostAttentionCategory, string>;
}> = {
  en: {
    yesterday: "Yesterday",
    today: "Today",
    dontMiss: "DON'T MISS TODAY",
    overdue: "Overdue",
    dueToday: "Due today",
    incomplete: "Incomplete",
    upcoming: "Upcoming",
    required: "Required training",
    action: "Action",
    practice: "Practice",
    leadershipTitle: "LEADERSHIP ATTENTION",
    leadershipSub: "People who may need your attention today",
    showAll: (n) => `Show all ${n}`,
    showLess: "Show less",
    hostTags: {
      FOLLOW_UP_OVERDUE: "Follow-up overdue",
      FOLLOW_UP_NEEDED: "Needs follow-up",
      SHARED_REVIEW_DUE: "Shared response awaiting review",
    },
  },
  ko: {
    yesterday: "어제의 나",
    today: "오늘의 제안",
    dontMiss: "오늘 놓치지 말 것",
    overdue: "기한 지남",
    dueToday: "오늘 마감",
    incomplete: "미완료",
    upcoming: "예정",
    required: "필수 교육",
    action: "행동",
    practice: "연습",
    leadershipTitle: "리더십 확인",
    leadershipSub: "오늘 관심을 기울여야 할 사람",
    showAll: (n) => `${n}명 모두 보기`,
    showLess: "접기",
    hostTags: {
      FOLLOW_UP_OVERDUE: "후속 확인 지연",
      FOLLOW_UP_NEEDED: "후속 확인 필요",
      SHARED_REVIEW_DUE: "공유 이해 검토 대기",
    },
  },
};

function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function TodayPersonalBrief({ locale }: { locale: string }) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [brief, setBrief] = useState<Brief | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hostAttention, setHostAttention] = useState<HostAttention[]>([]);
  const [showAllHost, setShowAllHost] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tz = deviceTz();
    void (async () => {
      try {
        const qs = new URLSearchParams({ locale: loc });
        if (tz) qs.set("tz", tz);
        const res = await fetch(`/api/me/today/brief?${qs.toString()}`, { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as {
          ok?: boolean;
          brief?: Brief | null;
          reminders?: Reminder[];
          hostAttention?: HostAttention[];
        };
        if (cancelled || !d?.ok) return;
        setBrief(d.brief ?? null);
        setReminders(Array.isArray(d.reminders) ? d.reminders : []);
        setHostAttention(Array.isArray(d.hostAttention) ? d.hostAttention : []);
      } catch {
        /* fail-soft — render nothing */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loc]);

  if (!loaded) return null;
  if (!brief && reminders.length === 0 && hostAttention.length === 0) return null; // nothing to say → no card

  const stateLabel = (s: Reminder["state"]) =>
    s === "overdue" ? t.overdue : s === "due_today" ? t.dueToday : s === "incomplete_required" ? t.incomplete : t.upcoming;
  // FOLLOW_UP_DUE carries its own checkpoint eyebrow inside the title ("7-day follow-up · …"),
  // so it renders with no category prefix (catLabel "").
  const catLabel = (c: Reminder["category"]) =>
    c === "REQUIRED_LEARNING"
      ? t.required
      : c === "ACTION_DUE"
        ? t.action
        : c === "PRACTICE_DUE"
          ? t.practice
          : "";
  const stateTone = (s: Reminder["state"]) =>
    s === "overdue" ? "text-red-300/80 border-red-400/30" : s === "due_today" ? "text-[#E5B769] border-[#C9A66B]/35" : "text-white/50 border-white/12";

  const hostTagTone = (c: HostAttentionCategory) =>
    c === "FOLLOW_UP_OVERDUE"
      ? "text-red-300/80 border-red-400/30"
      : c === "FOLLOW_UP_NEEDED"
        ? "text-[#E5B769] border-[#C9A66B]/35"
        : "text-white/55 border-white/14";

  const hostVisible = showAllHost ? hostAttention : hostAttention.slice(0, HOST_PREVIEW);

  return (
    <section data-testid="today-personal-brief" className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
      {brief ? (
        <div className="flex flex-col gap-2" data-testid="brief-ai">
          <div>
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/80">{t.yesterday}</span>
            <p className="mt-0.5 text-sm leading-6 text-white/80">{brief.yesterdayObservation}</p>
          </div>
          <div>
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/80">{t.today}</span>
            <p className="mt-0.5 text-sm leading-6 text-white/80">{brief.todaySuggestion}</p>
          </div>
        </div>
      ) : null}

      {reminders.length > 0 ? (
        <div className="flex flex-col gap-2" data-testid="brief-reminders">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/40">{t.dontMiss}</span>
          <ul className="flex flex-col gap-1.5">
            {reminders.map((r) => (
              <li key={r.stableId} data-testid="brief-reminder" data-category={r.category} data-state={r.state}>
                <a href={r.canonicalDeepLink} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                    {catLabel(r.category) ? <span className="text-white/40">{catLabel(r.category)} · </span> : null}
                    {r.title}
                  </span>
                  <span className={"shrink-0 rounded-md border px-2 py-0.5 text-[0.68rem] " + stateTone(r.state)}>{stateLabel(r.state)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hostAttention.length > 0 ? (
        <div className="flex flex-col gap-2" data-testid="brief-host-attention">
          <div className="flex flex-col gap-0.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/70">{t.leadershipTitle}</span>
            <span className="text-[0.72rem] text-white/45">{t.leadershipSub}</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {hostVisible.map((h) => (
              <li key={h.stableId} data-testid="host-attention-row" data-category={h.category}>
                <a href={h.deepLink} className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/85">{h.participantDisplayName}</span>
                    <span className={"shrink-0 rounded-md border px-2 py-0.5 text-[0.66rem] " + hostTagTone(h.category)}>{t.hostTags[h.category]}</span>
                  </div>
                  <span className="truncate text-xs text-white/45">{h.trainingTitle}</span>
                  <span className="text-xs text-white/60">{h.reason}</span>
                </a>
              </li>
            ))}
          </ul>
          {hostAttention.length > HOST_PREVIEW ? (
            <button
              type="button"
              data-testid="host-attention-toggle"
              onClick={() => setShowAllHost((v) => !v)}
              className="self-start pt-0.5 text-xs text-white/50 hover:text-white/80"
            >
              {showAllHost ? t.showLess : t.showAll(hostAttention.length)}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
