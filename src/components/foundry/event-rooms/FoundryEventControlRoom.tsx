"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale, EventRoomsCopy } from "./copy";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerSnapshot } from "./types";
import { useEventSnapshot } from "./useEventSnapshot";
import { FoundryEventQr } from "./FoundryEventQr";
import { FoundryParticipantRoster } from "./FoundryParticipantRoster";
import { FoundryTrainingOutcome } from "./FoundryTrainingOutcome";
import FoundrySharedReview from "./FoundrySharedReview";
import FoundryFollowupStatus from "./FoundryFollowupStatus";
import { FoundryShareControls } from "./FoundryShareControls";
import type { HostFocusSection } from "@/components/app-shell/hostDeepLink";

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
  onCreateNewVersion,
  focusSection,
  focusId,
}: {
  eventId: string;
  initialSnapshot?: ManagerSnapshot | null;
  locale: Locale;
  onBack: () => void;
  /** Host action: open the guided Arena-practice builder for this training. */
  onCreateArenaPractice?: () => void;
  /** Host action (Slice 3.2C-B1): create a new version of this published Guided training. */
  onCreateNewVersion?: () => void;
  /** Host Leadership Attention deep link (Slice 3.1B-3L): scroll/highlight the exact row in the
   *  named section. 'followups' → focusId is a followup id; 'shared-understanding' → a progress id. */
  focusSection?: HostFocusSection;
  focusId?: string;
}) {
  const t: EventRoomsCopy = EVENT_ROOMS_COPY[locale];
  const { snapshot, setSnapshot, refresh, error, settled } = useEventSnapshot(eventId, initialSnapshot);

  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Create-new-version in-flight guard (Slice 3.2C-B1): the POST + Builder handoff
  // happens in the parent; this only prevents a double-tap from firing twice.
  const [creatingVersion, setCreatingVersion] = useState(false);
  const onCreateNewVersionClick = useCallback(() => {
    if (creatingVersion || !onCreateNewVersion) return;
    setCreatingVersion(true);
    onCreateNewVersion();
  }, [creatingVersion, onCreateNewVersion]);

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

          {/* Create new version — only for a Guided published training the caller owns
              (server-gated via snapshot.revisable). Creates a NEW draft version in the
              SAME Program; the old published training stays unchanged. (Slice 3.2C-B1) */}
          {onCreateNewVersion && snapshot?.revisable ? (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={onCreateNewVersionClick}
                disabled={creatingVersion}
                data-testid="foundry-create-new-version"
                className="self-start rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/85 transition-colors hover:bg-white/[0.08] disabled:opacity-60"
              >
                {creatingVersion ? t.createNewVersionBusy : t.createNewVersion}
              </button>
              <span className="text-xs leading-5 text-white/45">{t.createNewVersionNote}</span>
            </div>
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

          {/*
            TRAINING OUTCOME (Slice R4-R3A) — placed ABOVE the roster on purpose. The roster
            answers "who is here"; this answers "did anything change", which is the question a
            Host actually opened the room with. Self-gating: absent when the server could not
            assemble it, so the room never depends on it.
          */}
          <FoundryTrainingOutcome eventId={eventId} t={t} />

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
            {/* Shared Understanding review (Slice 3.1B-3G) — self-gates: renders only when a shared
                question is configured AND a learner has submitted a shared response. Never shows
                private Reflection. */}
            <FoundrySharedReview
              eventId={eventId}
              locale={locale}
              focusProgressId={focusSection === "shared-understanding" ? focusId : undefined}
            />
            {/* Follow-up Status (Slice 3.1B-3K) — INDEPENDENT of the shared-question gate; self-gates
                to nothing when the event has no follow-up obligations. Learner-reported outcomes only. */}
            <FoundryFollowupStatus
              eventId={eventId}
              locale={locale}
              focusFollowupId={focusSection === "followups" ? focusId : undefined}
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
      ) : settled || error ? (
        // 3.2G-R4: the fetch has settled with no owned event (error / not-found / owner-scoped empty) —
        // a calm, compact NON-resolving surface (never a spinner-forever, never a blank body). The Back
        // control above stays available. Server authorization is unchanged; nothing is disclosed.
        <div role="status" className="flex min-h-[30vh] items-center justify-center px-4 text-center text-sm text-white/55" data-testid="control-room-unavailable">
          {t.controlUnavailable}
        </div>
      ) : (
        // 3.2G-R4: control-BOUND resolving surface shown IMMEDIATELY on the first control render while
        // the Event snapshot loads — replaces the empty body flash. Compact, dark BTY surface, calm.
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="flex min-h-[30vh] items-center justify-center px-4 text-center text-sm text-white/55"
          data-testid="control-room-resolving"
        >
          {t.controlResolving}
        </div>
      )}
    </div>
  );
}
