"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale, EventRoomsCopy } from "./copy";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerSnapshot } from "./types";
import { useEventSnapshot } from "./useEventSnapshot";
import { FoundryEventQr } from "./FoundryEventQr";
import { FoundryParticipantRoster } from "./FoundryParticipantRoster";
import { FoundryShareControls } from "./FoundryShareControls";

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

export function FoundryEventControlRoom({
  eventId,
  initialSnapshot,
  locale,
  onBack,
  onCreateArenaPractice,
}: {
  eventId: string;
  initialSnapshot?: ManagerSnapshot | null;
  locale: Locale;
  onBack: () => void;
  /** Host action: open the guided Arena-practice builder for this training. */
  onCreateArenaPractice?: () => void;
}) {
  const t: EventRoomsCopy = EVENT_ROOMS_COPY[locale];
  const { snapshot, setSnapshot, refresh } = useEventSnapshot(eventId, initialSnapshot);

  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Draft-entry label clarity (3.0B.2): Create → Continue (unpublished draft exists)
  // → Manage (a published practice exists). The action still opens the same editor.
  const [arenaLabel, setArenaLabel] = useState<string>(t.createArenaPractice);
  useEffect(() => {
    if (!onCreateArenaPractice) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/bty/foundry/arena-drafts?eventId=${encodeURIComponent(eventId)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!alive || !res.ok) return;
        const data = (await res.json()) as { drafts?: unknown[]; has_published?: boolean };
        if (!alive) return;
        if (data.has_published) setArenaLabel(t.manageArenaPractice);
        else if (Array.isArray(data.drafts) && data.drafts.length > 0) setArenaLabel(t.continueArenaPractice);
        else setArenaLabel(t.createArenaPractice);
      } catch {
        /* keep default label */
      }
    })();
    return () => {
      alive = false;
    };
  }, [eventId, onCreateArenaPractice, t.createArenaPractice, t.continueArenaPractice, t.manageArenaPractice]);

  const event = snapshot?.event ?? null;
  const participants = snapshot?.participants ?? [];
  const isOpen = event?.status === "open";
  const training = event?.training ?? null;
  const document = event?.document ?? null;
  const joinedCount = snapshot?.joined_count ?? participants.length;
  const completedCount = snapshot?.completed_count ?? 0;

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

          {/* Quiet training identity — the video this room is built around. */}
          {training ? (
            <div className="overflow-hidden rounded-xl border border-white/8 bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={training.youtube_thumbnail_url}
                alt=""
                className="aspect-video w-full object-cover opacity-90"
                loading="lazy"
              />
            </div>
          ) : document ? (
            <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-3">
              <p className="truncate text-sm text-white/85">{document.file_name ?? "PDF"}</p>
              <p className="mt-0.5 text-xs text-white/45">
                {document.page_count} {document.page_count === 1 ? "page" : "pages"}
              </p>
            </div>
          ) : null}

          {/* Create Arena practice — the one clear action to turn this training into
              a guided practice scenario draft. Host-only (this whole room is gated). */}
          {onCreateArenaPractice ? (
            <button
              type="button"
              onClick={onCreateArenaPractice}
              className="self-start rounded-xl border border-[#C9A66B]/40 bg-[#C9A66B]/[0.08] px-5 py-3 text-sm font-semibold text-[#C9A66B] transition-colors hover:bg-[#C9A66B]/[0.14]"
            >
              {arenaLabel} →
            </button>
          ) : null}

          {isOpen ? (
            <>
              {/* Show QR — the canonical join URL, already visible (not duplicated). */}
              <FoundryEventQr url={event.join_url} t={t} />
              {/* Share this room — Copy invitation + Share to Teams (same URL as QR). */}
              <FoundryShareControls event={event} locale={locale} t={t} />
              <button
                type="button"
                onClick={onRotate}
                disabled={busy}
                className="self-start text-sm text-white/40 transition-colors hover:text-white/70 disabled:opacity-50"
              >
                {t.rotateQr}
              </button>
            </>
          ) : (
            <p className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-white/55">
              {t.closedNotice}
            </p>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">
              {t.joinedHeader(joinedCount)}
              {completedCount > 0 ? (
                <span className="ml-2 text-[#C9A66B]/80">
                  · {t.completedCount(completedCount, joinedCount)}
                </span>
              ) : null}
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
