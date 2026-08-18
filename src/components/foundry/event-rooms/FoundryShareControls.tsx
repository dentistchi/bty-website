"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readContentType } from "@/domain/foundry/events/content-type";
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
  // What the manual (clipboard-denied) fallback textarea shows — the URL for the
  // Copy link action, the full invitation for a Teams-share fallback.
  const [manualValue, setManualValue] = useState("");
  const [teamsState, setTeamsState] = useState<"idle" | "opening" | "fallback">("idle");
  const [status, setStatus] = useState(""); // aria-live announcement
  // Native = the iOS system share sheet (app-neutral primary). Resolved after
  // mount so SSR/hydration render the web labels first, then align on the client.
  const [native, setNative] = useState(false);
  const manualRef = useRef<HTMLTextAreaElement | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setNative(isNative()), []);

  /*
    R4-R2G — the invitation is built from the event's REAL type. The old ternary made every
    non-document room say "watch the training video". An unknown type falls back to the
    invitation's own safe default rather than being asserted here.
  */
  const contentType = readContentType(event.content_type) ?? "youtube";
  const invitation = buildFoundryInvitation({
    locale,
    title: event.title,
    contentType,
    participantUrl: event.join_url,
    intro: event.document?.intro ?? null,
  });
  const teamsMessage = buildTeamsMessage({ locale, title: event.title });
  const teamsUrl = buildTeamsShareUrl({ participantUrl: event.join_url, message: teamsMessage });
  // Share-sheet body: the URL rides in the native share's separate `url` field, so
  // it must NOT be duplicated in the text.
  const shareText = buildFoundryInvitation({
    locale,
    title: event.title,
    contentType,
    participantUrl: event.join_url,
    intro: event.document?.intro ?? null,
    omitUrl: true,
  });

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  const flashCopied = useCallback((msg: string) => {
    setCopyState("copied");
    setStatus(msg);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), 2200);
  }, []);

  // Write an EXPLICIT payload — never an implicit one. The Copy link action passes
  // event.join_url (URL-only, address-bar-pasteable); a Teams fallback passes the
  // full invitation (a chat message). No caller shares an ambiguous default.
  const writeClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to manual
    }
    return false;
  }, []);

  const revealManual = useCallback((text: string) => {
    setManualValue(text);
    setCopyState("manual");
    setStatus(t.copyFailedManual);
    // Move focus to the selectable text so keyboard users can copy immediately.
    setTimeout(() => {
      manualRef.current?.focus();
      manualRef.current?.select();
    }, 0);
  }, [t.copyFailedManual]);

  // Copy link — copies EXACTLY the canonical join URL (no title, no instructions,
  // no "Open the Foundry room:" prefix, no newline) so a paste into a browser
  // address bar opens the employee room directly.
  const onCopyLink = useCallback(async () => {
    const ok = await writeClipboard(event.join_url);
    if (ok) flashCopied(t.linkCopied);
    else revealManual(event.join_url);
  }, [writeClipboard, flashCopied, revealManual, event.join_url, t.linkCopied]);

  // Re-copy whatever the manual fallback is currently showing.
  const onCopyManual = useCallback(async () => {
    const ok = await writeClipboard(manualValue);
    if (ok) flashCopied(manualValue === event.join_url ? t.linkCopied : t.invitationCopied);
  }, [writeClipboard, flashCopied, manualValue, event.join_url, t.linkCopied, t.invitationCopied]);

  const onShareTeams = useCallback(async () => {
    // NATIVE shell (Capacitor WKWebView): open the iOS SYSTEM SHARE SHEET so the
    // already-installed, already-signed-in Microsoft Teams app receives the share
    // — NOT the web teams.microsoft.com/share page (which forces a browser
    // Microsoft login). The canonical join URL rides in the separate `url` field.
    if (isNative() && typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setTeamsState("opening");
      setStatus(t.chooseAppToShare);
      try {
        await navigator.share({ title: event.title, text: shareText, url: event.join_url });
        // Sheet handed off to the chosen app. We do NOT assert a successful send.
        setTeamsState("idle");
        setStatus("");
        return;
      } catch (err) {
        // User dismissed the sheet → not an error, and NOT a successful share.
        if ((err as { name?: string })?.name === "AbortError") {
          setTeamsState("idle");
          setStatus("");
          return;
        }
        // Share API failed → honest copy fallback.
        const copied = await writeClipboard(invitation);
        setTeamsState("fallback");
        setStatus(copied ? t.readyToPasteNative : t.teamsCouldNotOpen);
        if (!copied) revealManual(invitation);
        return;
      }
    }
    if (isNative()) {
      // Native shell without Web Share support → copy fallback. (A guaranteed
      // native sheet here would require @capacitor/share in the shell — see report.)
      setTeamsState("opening");
      const copied = await writeClipboard(invitation);
      setTeamsState("fallback");
      setStatus(copied ? t.readyToPasteNative : t.teamsCouldNotOpen);
      if (!copied) revealManual(invitation);
      return;
    }

    // WEB (desktop): Microsoft's official Share-to-Teams dialog (unchanged).
    setTeamsState("opening");
    setStatus(t.openingTeams);
    let win: Window | null = null;
    try {
      win = window.open(teamsUrl, "_blank", "noopener,noreferrer");
    } catch {
      win = null;
    }
    if (win) {
      setTeamsState("idle");
      setStatus("");
      return;
    }
    // Popup blocked / unsupported → honest fallback: copy + tell user to paste.
    const copied = await writeClipboard(invitation);
    setTeamsState("fallback");
    setStatus(copied ? t.readyToPaste : t.teamsCouldNotOpen);
    if (!copied) revealManual(invitation);
  }, [
    event.title,
    event.join_url,
    invitation,
    shareText,
    teamsUrl,
    writeClipboard,
    revealManual,
    t.chooseAppToShare,
    t.openingTeams,
    t.readyToPaste,
    t.readyToPasteNative,
    t.teamsCouldNotOpen,
  ]);

  return (
    <section className="flex flex-col gap-2" aria-label={t.shareRoomHeader}>
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">{t.shareRoomHeader}</h2>

      {native ? (
        // Native: the primary action opens the iOS system share sheet (app-neutral
        // "Share invitation"); Copy invitation stays as a quieter secondary.
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onShareTeams}
            aria-label={t.shareInvitation}
            className="w-full rounded-xl bg-[#C9A66B] px-4 py-3 text-sm font-semibold text-[#0B1F3A] transition-opacity hover:opacity-90"
          >
            {t.shareInvitation}
          </button>
          <button
            type="button"
            onClick={onCopyLink}
            aria-label={t.copyInvitation}
            className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06]"
          >
            {copyState === "copied" ? t.linkCopied : t.copyInvitation}
          </button>
        </div>
      ) : (
        // Web desktop: Copy link + the official Share to Teams dialog (unchanged).
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCopyLink}
            aria-label={t.copyInvitation}
            className="flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/[0.07]"
          >
            {copyState === "copied" ? t.linkCopied : t.copyInvitation}
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
      )}

      {/* Fallback message for the share path (cancel/blocked/unsupported). */}
      {teamsState === "fallback" ? (
        <p className="text-xs text-white/60">{status || (native ? t.readyToPasteNative : t.readyToPaste)}</p>
      ) : null}

      {/* Manual-copy fallback: selectable invitation text when clipboard is denied. */}
      {copyState === "manual" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-white/55">{t.copyFailedManual}</p>
          <textarea
            ref={manualRef}
            readOnly
            value={manualValue}
            aria-label={t.copyInvitation}
            rows={3}
            className="w-full resize-none rounded-lg bg-black/30 px-3 py-2 text-xs text-white/90 outline-none"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCopyManual}
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
