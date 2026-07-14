"use client";

import { useCallback, useRef, useState } from "react";
import type { Locale, EventRoomsCopy } from "./copy";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerSnapshot } from "./types";
import { useEventSnapshot } from "./useEventSnapshot";
import { FoundryEventQr } from "./FoundryEventQr";
import { FoundryParticipantRoster } from "./FoundryParticipantRoster";

async function postAction(url: string): Promise<ManagerSnapshot | null> {
  try {
    const res = await fetch(url, { method: "POST", credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as ManagerSnapshot;
    return data?.event ? data : null;
  } catch {
    return null;
  }
}

/** Share the join URL via the native share sheet, falling back to clipboard copy. */
async function shareJoinUrl(url: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ url });
      return "shared";
    }
  } catch {
    // user cancelled or share failed → fall through to copy
  }
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
  } catch {
    // ignore
  }
  return "failed";
}

export function FoundryEventControlRoom({
  eventId,
  initialSnapshot,
  locale,
  onBack,
}: {
  eventId: string;
  initialSnapshot?: ManagerSnapshot | null;
  locale: Locale;
  onBack: () => void;
}) {
  const t: EventRoomsCopy = EVENT_ROOMS_COPY[locale];
  const { snapshot, setSnapshot, refresh } = useEventSnapshot(eventId, initialSnapshot);

  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const event = snapshot?.event ?? null;
  const participants = snapshot?.participants ?? [];
  const isOpen = event?.status === "open";

  const onShare = useCallback(async () => {
    if (!event) return;
    const result = await shareJoinUrl(event.join_url);
    if (result === "copied") {
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [event]);

  const onRotate = useCallback(async () => {
    if (busy || !isOpen) return;
    if (typeof window !== "undefined" && !window.confirm(t.rotateConfirm)) return;
    setBusy(true);
    const next = await postAction(`/api/bty/foundry/events/${encodeURIComponent(eventId)}/rotate-qr`);
    if (next) setSnapshot(next);
    setBusy(false);
  }, [busy, isOpen, eventId, setSnapshot, t.rotateConfirm]);

  const onClose = useCallback(async () => {
    if (busy || !isOpen) return;
    if (typeof window !== "undefined" && !window.confirm(t.closeConfirm)) return;
    setBusy(true);
    const next = await postAction(`/api/bty/foundry/events/${encodeURIComponent(eventId)}/close`);
    if (next) setSnapshot(next);
    setBusy(false);
  }, [busy, isOpen, eventId, setSnapshot, t.closeConfirm]);

  const onRemove = useCallback(
    async (participantId: string) => {
      if (removingId) return;
      if (typeof window !== "undefined" && !window.confirm(t.removeConfirm)) return;
      setRemovingId(participantId);
      const next = await postAction(
        `/api/bty/foundry/events/${encodeURIComponent(eventId)}/participants/${encodeURIComponent(participantId)}/remove`,
      );
      if (next) setSnapshot(next);
      else void refresh();
      setRemovingId(null);
    },
    [removingId, eventId, setSnapshot, refresh, t.removeConfirm],
  );

  return (
    <div className="btyFadeIn flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-white/50 transition-colors hover:text-white/80"
        >
          ← {t.back}
        </button>
        <span className="text-xs uppercase tracking-[0.16em] text-[#C9A66B]/90">{t.eyebrow}</span>
      </div>

      {event ? (
        <>
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold leading-snug text-white">{event.title}</h1>
            <span
              className={
                "text-xs font-medium uppercase tracking-[0.14em] " +
                (isOpen ? "text-[#C9A66B]/90" : "text-white/40")
              }
            >
              {isOpen ? t.statusOpen : t.statusClosed}
            </span>
          </header>

          {isOpen ? (
            <>
              <FoundryEventQr url={event.join_url} t={t} />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onShare}
                  className="flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/[0.07]"
                >
                  {copied ? t.linkCopied : t.shareLink}
                </button>
                <button
                  type="button"
                  onClick={onRotate}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.07] disabled:opacity-50"
                >
                  {t.rotateQr}
                </button>
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-white/55">
              {t.closedNotice}
            </p>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">
              {t.joinedHeader(participants.length)}
            </h2>
            <FoundryParticipantRoster
              participants={participants}
              eventOpen={isOpen}
              onRemove={onRemove}
              removingId={removingId}
              t={t}
            />
          </section>

          {isOpen ? (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="mt-2 self-start text-sm text-white/40 transition-colors hover:text-white/70 disabled:opacity-50"
            >
              {t.closeEvent}
            </button>
          ) : null}
        </>
      ) : (
        <div aria-hidden className="min-h-[40vh]" />
      )}
    </div>
  );
}
