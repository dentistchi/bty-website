"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale, EventRoomsCopy } from "./copy";
import type { ManagerEvent } from "./types";
import { isNative } from "@/lib/native/isNative";
import {
  buildFoundryInvitation,
  buildTeamsMessage,
  buildTeamsShareUrl,
} from "@/lib/bty/foundry/events/foundryInvitation";

/**
 * "Share this room" — Copy invitation + Share to Teams. Both encode the SAME
 * canonical participant URL as the visible QR (event.join_url); this component
 * never mints a token or URL. Copy invitation is the primary cross-device action;
 * Share to Teams is a desktop enhancement using Microsoft's official URL-based
 * share endpoint (no external launcher script → no CSP change, nothing to inject/
 * clean up). Every path fails honestly to a manual paste fallback and never
 * claims content was shared before Teams confirms the user's action.
 */
export function FoundryShareControls({
  event,
  locale,
  t,
}: {
  event: ManagerEvent;
  locale: Locale;
  t: EventRoomsCopy;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [teamsState, setTeamsState] = useState<"idle" | "opening" | "fallback">("idle");
  const [status, setStatus] = useState(""); // aria-live announcement
  const manualRef = useRef<HTMLTextAreaElement | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contentType = event.content_type === "document" ? "document" : "youtube";
  const invitation = buildFoundryInvitation({
    locale,
    title: event.title,
    contentType,
    participantUrl: event.join_url,
    intro: event.document?.intro ?? null,
  });
  const teamsMessage = buildTeamsMessage({ locale, title: event.title });
  const teamsUrl = buildTeamsShareUrl({ participantUrl: event.join_url, message: teamsMessage });

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  const flashCopied = useCallback(() => {
    setCopyState("copied");
    setStatus(t.invitationCopied);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), 2200);
  }, [t.invitationCopied]);

  const writeClipboard = useCallback(async (): Promise<boolean> => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(invitation);
        return true;
      }
    } catch {
      // fall through to manual
    }
    return false;
  }, [invitation]);

  const revealManual = useCallback(() => {
    setCopyState("manual");
    setStatus(t.copyFailedManual);
    // Move focus to the selectable text so keyboard users can copy immediately.
    setTimeout(() => {
      manualRef.current?.focus();
      manualRef.current?.select();
    }, 0);
  }, [t.copyFailedManual]);

  const onCopy = useCallback(async () => {
    const ok = await writeClipboard();
    if (ok) flashCopied();
    else revealManual();
  }, [writeClipboard, flashCopied, revealManual]);

  const onShareTeams = useCallback(async () => {
    setTeamsState("opening");
    setStatus(t.openingTeams);

    // Native shell (Capacitor WKWebView): window.open to an external URL is
    // blocked, so open the SAME Teams share URL through the runtime-injected
    // Browser bridge (system browser → the Teams app can intercept). No
    // @capacitor/* import; falls through to the web path if the bridge is absent.
    if (isNative()) {
      const browser = window.Capacitor?.Plugins?.Browser;
      if (browser?.open) {
        try {
          await browser.open({ url: teamsUrl });
          setTeamsState("idle");
          setStatus("");
          return;
        } catch {
          // fall through to web open / fallback
        }
      }
    }

    let win: Window | null = null;
    try {
      win = window.open(teamsUrl, "_blank", "noopener,noreferrer");
    } catch {
      win = null;
    }
    if (win) {
      // Teams opened in its own window/tab; the user completes the share there.
      setTeamsState("idle");
      setStatus("");
      return;
    }
    // Popup blocked / unsupported → honest fallback: copy the invitation and tell
    // the user to paste it. Never claim it was shared.
    const copied = await writeClipboard();
    setTeamsState("fallback");
    setStatus(copied ? t.readyToPaste : t.teamsCouldNotOpen);
    if (!copied) revealManual();
  }, [teamsUrl, writeClipboard, revealManual, t.openingTeams, t.readyToPaste, t.teamsCouldNotOpen]);

  return (
    <section className="flex flex-col gap-2" aria-label={t.shareRoomHeader}>
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">{t.shareRoomHeader}</h2>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCopy}
          aria-label={t.copyInvitation}
          className="flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/[0.07]"
        >
          {copyState === "copied" ? t.invitationCopied : t.copyInvitation}
        </button>
        <button
          type="button"
          onClick={onShareTeams}
          aria-label={t.shareToTeams}
          className="flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.07]"
        >
          {teamsState === "opening" ? t.openingTeams : t.shareToTeams}
        </button>
      </div>

      {/* Fallback message for the Teams path (popup blocked / unsupported). */}
      {teamsState === "fallback" ? (
        <p className="text-xs text-white/60">{status || t.readyToPaste}</p>
      ) : null}

      {/* Manual-copy fallback: selectable invitation text when clipboard is denied. */}
      {copyState === "manual" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-white/55">{t.copyFailedManual}</p>
          <textarea
            ref={manualRef}
            readOnly
            value={invitation}
            aria-label={t.copyInvitation}
            rows={6}
            className="w-full resize-none rounded-lg bg-black/30 px-3 py-2 text-xs text-white/90 outline-none"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCopy}
              className="rounded-lg border border-white/12 px-3 py-2 text-xs text-white/80 hover:bg-white/[0.06]"
            >
              {t.copyInvitation}
            </button>
            <a
              href={teamsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white/12 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.06]"
            >
              {t.openTeams}
            </a>
          </div>
        </div>
      ) : null}

      {/* Screen-reader confirmation (also the calm visible cue lives on the buttons). */}
      <span aria-live="polite" className="sr-only">
        {status}
      </span>
    </section>
  );
}
