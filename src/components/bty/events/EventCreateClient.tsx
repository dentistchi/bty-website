"use client";

import { useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

/**
 * Reality Event — Host create flow (Slice 3.2D-EVENT V1). An authorized leader
 * opens ONE real event; the server (POST /api/bty/events) inserts `bty_events`
 * and returns a signed `btyev1` QR + deep-link URL, which is rendered here so
 * participants can scan it.
 *
 * Honesty / scope invariants:
 *  - Only the fields the create API requires; actor/org identity stay server-side.
 *  - No local "created" state before the server confirms (canonical response only).
 *  - No internal IDs (event id / creator / org) are shown.
 *  - Leader-track authority is enforced by the API (403) → canonical denial here.
 *  - No list / history / edit / delete / roster / recurring / program linking.
 */

const COPY = {
  en: {
    heading: "Open an event",
    intro: "Open a real moment for your team to participate in.",
    title: "Event name",
    titlePh: "Morning huddle",
    type: "Kind of event",
    typePh: "huddle",
    xp: "Participation XP (10–100)",
    until: "Open until",
    submit: "Open event",
    working: "Opening…",
    createdHeading: "Event ready",
    qrAria: "Reality Event QR code",
    scanInstruction: "Show this to participants — they scan to record their participation.",
    viewEvents: "View my events",
    another: "Open another event",
    backLearn: "Back to Learn",
    errors: {
      title_required: "Enter an event name.",
      event_type_required: "Enter the kind of event.",
      xp_value_invalid: "Participation XP must be a whole number from 10 to 100.",
      valid_until_invalid: "Choose when the event stays open.",
      valid_until_must_be_future: "The open-until time must be in the future.",
      LEADER_TRACK_REQUIRED: "You're not authorized to open events.",
      unauthorized: "You're not authorized to open events.",
      server: "Something went wrong. Please try again.",
    } as Record<string, string>,
  },
  /*
    WRITTEN AS KOREAN, AND AGREEING WITH THE DOOR THAT OPENS IT.

    The Learn landing closed on "이벤트 만들기 / 내가 만든 이벤트"; this screen still said
    "열기" and carried the translated line the landing pass removed. The QR aria label named the
    product internally — the one string a screen reader reads aloud.

    QR IS THE WHOLE JOIN STORY, measured: the create API returns a signed scan URL and it is
    rendered only as a QR, with no share-link control here or on the Host detail screen. So the
    intro says how people get in, which the title cannot, and promises no link.
  */
  ko: {
    heading: "이벤트 만들기",
    intro: "팀원은 QR 코드를 스캔해 참여합니다.",
    title: "이벤트 이름",
    titlePh: "아침 모임",
    type: "이벤트 종류",
    typePh: "모임",
    xp: "참여 XP (10–100)",
    until: "참여 마감 시각",
    submit: "이벤트 만들기",
    working: "만드는 중…",
    createdHeading: "이벤트가 만들어졌습니다",
    qrAria: "이벤트 참여 QR 코드",
    scanInstruction: "팀원에게 이 QR 코드를 보여주세요. 스캔하면 참여가 기록됩니다.",
    viewEvents: "내가 만든 이벤트 보기",
    another: "이벤트 하나 더 만들기",
    backLearn: "배우기로 돌아가기",
    errors: {
      title_required: "이벤트 이름을 입력하세요.",
      event_type_required: "이벤트 종류를 입력하세요.",
      xp_value_invalid: "참여 XP는 10에서 100 사이의 정수여야 합니다.",
      valid_until_invalid: "참여 마감 시각을 선택하세요.",
      valid_until_must_be_future: "마감 시각은 지금보다 뒤여야 합니다.",
      LEADER_TRACK_REQUIRED: "이벤트를 만들 권한이 없습니다.",
      unauthorized: "이벤트를 만들 권한이 없습니다.",
      server: "문제가 발생했습니다. 다시 시도하세요.",
    } as Record<string, string>,
  },
};

type CreatedEvent = { title: string; qrUrl: string };

export default function EventCreateClient({ locale, onBack, onViewEvents }: { locale: string; onBack?: () => void; onViewEvents?: () => void }) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("");
  const [xpValue, setXpValue] = useState(20);
  const [validUntil, setValidUntil] = useState(""); // datetime-local value
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedEvent | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);

  async function submit() {
    setErrorReason(null);
    // Client-side mirror of the API validation (the API remains the authority).
    if (!title.trim()) return setErrorReason("title_required");
    if (!eventType.trim()) return setErrorReason("event_type_required");
    if (!Number.isInteger(xpValue) || xpValue < 10 || xpValue > 100) return setErrorReason("xp_value_invalid");
    const untilMs = validUntil ? new Date(validUntil).getTime() : NaN;
    if (!Number.isFinite(untilMs)) return setErrorReason("valid_until_invalid");
    if (untilMs <= Date.now()) return setErrorReason("valid_until_must_be_future");

    setSubmitting(true);
    try {
      const res = await fetch(`/api/bty/events?locale=${loc}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          title: title.trim(),
          event_type: eventType.trim(),
          xp_value: xpValue,
          valid_until: new Date(untilMs).toISOString(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { event?: { title?: string }; qrUrl?: string; error?: string };
      if (res.status === 403) return setErrorReason(data?.error === "LEADER_TRACK_REQUIRED" ? "LEADER_TRACK_REQUIRED" : "unauthorized");
      if (!res.ok || !data?.qrUrl) return setErrorReason(data?.error ?? "server");
      // Canonical server response only — never a locally fabricated event.
      setCreated({ title: data.event?.title ?? title.trim(), qrUrl: data.qrUrl });
    } catch {
      setErrorReason("server");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setCreated(null);
    setTitle("");
    setEventType("");
    setXpValue(20);
    setValidUntil("");
    setErrorReason(null);
  }

  // Back returns to Learn. In-shell (onBack provided) → a local callback so the installed app
  // never leaves the webview (Slice 3.2D-EVENT-R1); standalone/web fallback → a same-origin link.
  const back = (extra: string) =>
    onBack ? (
      <button type="button" onClick={onBack} data-testid="event-create-back" className={`text-xs font-medium text-white/45 hover:text-white/70 ${extra}`}>
        {t.backLearn}
      </button>
    ) : (
      <Link href={`/${loc}/app?tab=learn`} data-testid="event-create-back" className={`text-xs font-medium text-white/45 hover:text-white/70 ${extra}`}>
        {t.backLearn}
      </Link>
    );

  if (created) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-5 px-6 py-10 text-white" data-testid="event-create-done">
        <h1 className="text-xl font-semibold">{t.createdHeading}</h1>
        <p className="text-white/80">{created.title}</p>
        {/* Accessibility (R2): safe accessible name on the wrapper; SVG aria-hidden; the raw token
            payload is never placed in any text node. */}
        <div role="img" aria-label={t.qrAria} data-testid="event-create-qr-image" className="rounded-2xl bg-white p-4">
          <QRCodeSVG value={created.qrUrl} size={220} bgColor="#ffffff" fgColor="#0B1F3A" level="M" aria-hidden={true} />
        </div>
        <p className="text-center text-sm text-white/60">{t.scanInstruction}</p>
        <div className="flex flex-col items-center gap-2">
          {onViewEvents ? (
            <button type="button" onClick={onViewEvents} data-testid="event-create-view-events" className="rounded-full bg-[#C9A66B] px-6 py-2.5 text-sm font-semibold text-[#0B1F3A]">
              {t.viewEvents}
            </button>
          ) : null}
          <button type="button" onClick={reset} data-testid="event-create-another" className="text-sm font-semibold text-[#C9A66B]">
            {t.another}
          </button>
          {back("")}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6 py-10 text-white" data-testid="event-create">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t.heading}</h1>
        <p className="text-sm text-white/60">{t.intro}</p>
      </div>

      <label className="flex flex-col gap-1 text-sm text-white/70">
        {t.title}
        <input data-testid="event-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.titlePh}
          className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-white outline-none focus:border-[#C9A66B]/50" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-white/70">
        {t.type}
        <input data-testid="event-type" value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder={t.typePh}
          className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-white outline-none focus:border-[#C9A66B]/50" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-white/70">
        {t.xp}
        <input data-testid="event-xp" type="number" min={10} max={100} value={xpValue}
          onChange={(e) => setXpValue(parseInt(e.target.value, 10))}
          className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-white outline-none focus:border-[#C9A66B]/50" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-white/70">
        {t.until}
        <input data-testid="event-until" type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
          className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-white outline-none focus:border-[#C9A66B]/50" />
      </label>

      {errorReason ? (
        <p className="text-sm text-red-300" data-testid="event-create-error">{t.errors[errorReason] ?? t.errors.server}</p>
      ) : null}

      <button type="button" onClick={submit} disabled={submitting} data-testid="event-create-submit"
        className="rounded-full bg-[#C9A66B] px-6 py-2.5 text-sm font-semibold text-[#0B1F3A] disabled:opacity-50">
        {submitting ? t.working : t.submit}
      </button>

      {back("text-center")}
    </main>
  );
}
