"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * EventHostList (Slice 3.2E-EVENT-HOST V1) — the Host's in-shell "My events" view: the events this
 * Host opened + a participation COUNT each. Answers "I opened this real-world moment — did anyone
 * participate?". Read-only over GET /api/bty/events/mine (owner-scoped, count-only, no participant
 * PII). Manual refresh only (no polling/realtime). Rendered inside the Learn nested-view; Back → Learn.
 *
 * Honest language: participation is attendance, never completion/observation/sustained growth.
 */

type HostEvent = {
  eventId: string;
  title: string;
  state: "ACTIVE" | "ENDED" | "CANCELLED";
  createdAt: string;
  opensAt: string | null;
  closesAt: string | null;
  participationCount: number;
};

const COPY = {
  en: {
    heading: "My events",
    intro: "Participation in the Reality Events you opened.",
    loading: "Loading your events…",
    refreshing: "Refreshing…",
    refresh: "Refresh",
    emptyTitle: "No events yet.",
    emptyCta: "Open an event",
    back: "‹ Learn",
    errorBody: "We couldn't load your events.",
    retry: "Try again",
    state: { ACTIVE: "Active", ENDED: "Ended", CANCELLED: "Cancelled" } as Record<string, string>,
    count: (n: number) => (n === 0 ? "No participation recorded yet" : n === 1 ? "1 participation" : `${n} participations`),
    closes: (s: string) => `Open until ${s}`,
    closed: (s: string) => `Ended ${s}`,
  },
  ko: {
    heading: "내 이벤트",
    intro: "내가 연 리얼리티 이벤트의 참여 현황입니다.",
    loading: "이벤트를 불러오는 중…",
    refreshing: "새로고침 중…",
    refresh: "새로고침",
    emptyTitle: "아직 이벤트가 없습니다.",
    emptyCta: "이벤트 열기",
    back: "‹ 학습",
    errorBody: "이벤트를 불러오지 못했습니다.",
    retry: "다시 시도",
    state: { ACTIVE: "진행 중", ENDED: "종료됨", CANCELLED: "취소됨" } as Record<string, string>,
    count: (n: number) => (n === 0 ? "아직 참여 기록이 없습니다" : `참여 ${n}`),
    closes: (s: string) => `${s}까지`,
    closed: (s: string) => `${s} 종료`,
  },
};

function fmt(iso: string | null, loc: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function EventHostList({
  locale,
  onBack,
  onOpenCreate,
  onOpenDetail,
}: {
  locale: string;
  onBack: () => void;
  onOpenCreate: () => void;
  /** Open the owner Event detail (roster + QR reopen) for one event (Slice R1). */
  onOpenDetail: (eventId: string) => void;
}) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [events, setEvents] = useState<HostEvent[] | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (inFlight.current) return; // prevent duplicate simultaneous requests
    inFlight.current = true;
    if (isRefresh) setRefreshing(true);
    else setPhase("loading");
    try {
      const res = await fetch("/api/bty/events/mine", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as { events?: HostEvent[] };
      setEvents(Array.isArray(d.events) ? d.events : []);
      setPhase("ready");
    } catch {
      // On refresh failure, RETAIN the existing list; only a first load with no data shows error.
      if (!isRefresh && events == null) setPhase("error");
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [events]);

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="flex flex-col gap-4" data-testid="event-host-list">
      <button type="button" data-testid="event-host-back" onClick={onBack} className="self-start text-xs font-medium text-white/55 hover:text-white/85">
        {t.back}
      </button>

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-semibold tracking-tight text-white">{t.heading}</h1>
          <p className="text-xs text-white/50">{t.intro}</p>
        </div>
        {phase === "ready" ? (
          <button
            type="button"
            data-testid="event-host-refresh"
            onClick={() => load(true)}
            disabled={refreshing}
            className="shrink-0 rounded-lg border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/70 disabled:opacity-50"
          >
            {refreshing ? t.refreshing : t.refresh}
          </button>
        ) : null}
      </div>

      {phase === "loading" ? (
        <p className="text-sm text-white/40" role="status" data-testid="event-host-loading">{t.loading}</p>
      ) : phase === "error" ? (
        <div className="flex flex-col items-start gap-2" data-testid="event-host-error">
          <p className="text-sm text-white/70">{t.errorBody}</p>
          <button type="button" onClick={() => load(false)} className="rounded-full bg-[#C9A66B] px-4 py-2 text-xs font-semibold text-[#0B1F3A]">
            {t.retry}
          </button>
        </div>
      ) : events && events.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-6" data-testid="event-host-empty">
          <p className="text-sm text-white/70">{t.emptyTitle}</p>
          <button type="button" onClick={onOpenCreate} data-testid="event-host-empty-create" className="rounded-full bg-[#C9A66B] px-5 py-2 text-sm font-semibold text-[#0B1F3A]">
            {t.emptyCta}
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="event-host-events">
          {(events ?? []).map((e) => (
            <li key={e.eventId}>
              {/* R1: the whole card is one accessible control opening the owner Event detail. */}
              <button
                type="button"
                data-testid="event-host-row"
                onClick={() => onOpenDetail(e.eventId)}
                aria-label={`${e.title} — ${t.state[e.state]}, ${t.count(e.participationCount)}`}
                className="flex w-full flex-col gap-1 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.05]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-white/85">{e.title}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-white/45">{t.state[e.state]}</span>
                    <span aria-hidden="true" className="text-white/35">›</span>
                  </span>
                </div>
                <span className="text-[0.82rem] font-semibold text-[#E5B769]" data-testid="event-host-count">{t.count(e.participationCount)}</span>
                {e.closesAt ? (
                  <span className="text-[0.7rem] text-white/40">{e.state === "ENDED" ? t.closed(fmt(e.closesAt, loc)) : t.closes(fmt(e.closesAt, loc))}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
