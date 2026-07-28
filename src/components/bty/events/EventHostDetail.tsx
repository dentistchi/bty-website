"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

/**
 * EventHostDetail (Slice 3.2E-EVENT-HOST-R1) — the owner-only in-shell Event detail: title +
 * canonical state + time, the reopened Event QR (while ACTIVE), and the participant roster
 * (human-readable name + participation time). Read-only over GET /api/bty/events/mine/{eventId},
 * which enforces ownership server-side (404 for non-owners) and returns NO raw ids/tokens. Manual
 * refresh only. Participation is attendance — never completion/observation/sustained growth.
 */

type Participant = { displayName: string | null; participatedAt: string };
type EventDetail = {
  eventId: string;
  title: string;
  state: "ACTIVE" | "ENDED" | "CANCELLED";
  createdAt: string;
  closesAt: string | null;
  participationCount: number;
  qr: { available: boolean; payload?: string };
};

const COPY = {
  en: {
    back: "‹ My events",
    loading: "Loading event…",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    state: { ACTIVE: "Active", ENDED: "Ended", CANCELLED: "Cancelled" } as Record<string, string>,
    closes: (s: string) => `Open until ${s}`,
    closed: (s: string) => `Ended ${s}`,
    qrHeading: "Event QR",
    qrAria: "Reality Event QR code",
    qrInstruction: "Show this to participants — they scan to record their participation.",
    qrUnavailable: "The QR is available while the event is active.",
    rosterHeading: "Participation",
    count: (n: number) => (n === 0 ? "No participation recorded yet" : n === 1 ? "1 participation" : `${n} participations`),
    emptyRoster: "No participation recorded yet.",
    fallbackName: "Participant",
    errorBody: "We couldn't load this event.",
    retry: "Try again",
  },
  ko: {
    back: "‹ 내 이벤트",
    loading: "이벤트 불러오는 중…",
    refresh: "새로고침",
    refreshing: "새로고침 중…",
    state: { ACTIVE: "진행 중", ENDED: "종료됨", CANCELLED: "취소됨" } as Record<string, string>,
    closes: (s: string) => `${s}까지`,
    closed: (s: string) => `${s} 종료`,
    qrHeading: "이벤트 QR",
    qrAria: "리얼리티 이벤트 QR 코드",
    qrInstruction: "참가자에게 보여주세요 — 스캔하면 참여가 기록됩니다.",
    qrUnavailable: "QR은 이벤트가 진행 중일 때 사용할 수 있습니다.",
    rosterHeading: "참여",
    count: (n: number) => (n === 0 ? "아직 참여 기록이 없습니다" : `참여 ${n}`),
    emptyRoster: "아직 참여 기록이 없습니다.",
    fallbackName: "참가자",
    errorBody: "이벤트를 불러오지 못했습니다.",
    retry: "다시 시도",
  },
};

function fmtDate(iso: string | null, loc: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}
function fmtDateTime(iso: string, loc: string): string {
  try {
    return new Date(iso).toLocaleString(loc === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso.slice(0, 16);
  }
}

export default function EventHostDetail({ locale, eventId, onBack }: { locale: string; eventId: string; onBack: () => void }) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [detail, setDetail] = useState<{ event: EventDetail; participants: Participant[] } | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (isRefresh) setRefreshing(true);
    else setPhase("loading");
    try {
      const res = await fetch(`/api/bty/events/mine/${encodeURIComponent(eventId)}?locale=${loc}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as { event: EventDetail; participants: Participant[] };
      setDetail(d);
      setPhase("ready");
    } catch {
      if (!isRefresh && detail == null) setPhase("error");
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [eventId, loc, detail]);

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const ev = detail?.event;
  const roster = detail?.participants ?? [];

  return (
    <section className="flex flex-col gap-4" data-testid="event-host-detail">
      <div className="flex items-center justify-between gap-2">
        <button type="button" data-testid="event-detail-back" onClick={onBack} className="self-start text-xs font-medium text-white/55 hover:text-white/85">
          {t.back}
        </button>
        {phase === "ready" ? (
          <button
            type="button"
            data-testid="event-detail-refresh"
            onClick={() => load(true)}
            disabled={refreshing}
            className="shrink-0 rounded-lg border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/70 disabled:opacity-50"
          >
            {refreshing ? t.refreshing : t.refresh}
          </button>
        ) : null}
      </div>

      {phase === "loading" ? (
        <p className="text-sm text-white/40" role="status" data-testid="event-detail-loading">{t.loading}</p>
      ) : phase === "error" ? (
        <div className="flex flex-col items-start gap-2" data-testid="event-detail-error">
          <p className="text-sm text-white/70">{t.errorBody}</p>
          <button type="button" onClick={() => load(false)} className="rounded-full bg-[#C9A66B] px-4 py-2 text-xs font-semibold text-[#0B1F3A]">{t.retry}</button>
        </div>
      ) : ev ? (
        <>
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight text-white" data-testid="event-detail-title">{ev.title}</h1>
              <span className="shrink-0 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-white/45" data-testid="event-detail-state">{t.state[ev.state]}</span>
            </div>
            {ev.closesAt ? <p className="text-xs text-white/45">{ev.state === "ENDED" ? t.closed(fmtDate(ev.closesAt, loc)) : t.closes(fmtDate(ev.closesAt, loc))}</p> : null}
          </div>

          {/* Event QR — reopened while active; no raw token text (encoded in the QR only). */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4" data-testid="event-detail-qr">
            <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-white/40">{t.qrHeading}</span>
            {ev.qr.available && ev.qr.payload ? (
              <>
                {/* Accessibility (R2): the wrapper carries a SAFE accessible name; the SVG is
                    aria-hidden and the raw token payload is never placed in any text node. */}
                <div role="img" aria-label={t.qrAria} data-testid="event-detail-qr-image" className="rounded-2xl bg-white p-4">
                  <QRCodeSVG value={ev.qr.payload} size={200} bgColor="#ffffff" fgColor="#0B1F3A" level="M" aria-hidden={true} />
                </div>
                <p className="text-center text-xs text-white/55">{t.qrInstruction}</p>
              </>
            ) : (
              <p className="text-center text-xs text-white/45" data-testid="event-detail-qr-unavailable">{t.qrUnavailable}</p>
            )}
          </div>

          {/* Participation roster (owner-only). Human-readable name + time; never raw ids. */}
          <div className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3" data-testid="event-detail-roster">
            <div className="flex items-baseline justify-between">
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">{t.rosterHeading}</span>
              <span className="text-[0.82rem] font-semibold text-[#E5B769]" data-testid="event-detail-count">{t.count(ev.participationCount)}</span>
            </div>
            {roster.length === 0 ? (
              <p className="text-sm text-white/50" data-testid="event-detail-roster-empty">{t.emptyRoster}</p>
            ) : (
              <ul className="flex flex-col gap-1.5 pt-1">
                {roster.map((p, i) => (
                  <li key={i} data-testid="event-detail-participant" className="flex items-baseline justify-between gap-2 text-[0.85rem]">
                    <span className="min-w-0 truncate text-white/80">{p.displayName || t.fallbackName}</span>
                    <span className="shrink-0 text-white/40">{fmtDateTime(p.participatedAt, loc)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
