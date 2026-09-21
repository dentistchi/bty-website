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
import {
  buildTrainingDeepLink,
  buildTrainingInviteMessage,
  joinTokenFromParticipantUrl,
} from "@/domain/teams/trainingTarget";
import { isInsideTeamsTab, sendTrainingInTeams } from "@/lib/bty/teams/sendTrainingInTeams";

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
  /*
    TEAMS-NATIVE DELIVERY V1. Resolved after mount (like `native`), so SSR and hydration are
    unchanged and only a real Teams tab ever takes the Teams-native branch.
  */
  const [insideTeams, setInsideTeams] = useState(false);
  const [teamsHostName, setTeamsHostName] = useState<string | null>(null);
  const [sendState, setSendState] = useState<"idle" | "choosing">("idle");
  const manualRef = useRef<HTMLTextAreaElement | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setNative(isNative()), []);

  /*
    The Host's own name, for the first line of the draft ("<Host> shared training with you"). It
    comes from the Teams context and is PRESENTATION ONLY — nothing is looked up with it and
    nothing is authorized by it. Absent is fine: the message has a hostless form.
  */
  useEffect(() => {
    if (!isInsideTeamsTab()) return;
    setInsideTeams(true);
    let alive = true;
    void (async () => {
      try {
        const { app } = await import("@microsoft/teams-js");
        await app.initialize();
        const ctx = await app.getContext();
        const name = ctx?.user?.displayName;
        if (alive && typeof name === "string" && name.trim()) setTeamsHostName(name.trim());
      } catch {
        /* a missing name never blocks sending */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
  /*
    THE TEAMS-NATIVE INVITATION. It addresses the BTY PERSONAL TAB, never `/f/<token>` — a raw web
    URL inside a Teams chat is the "Link not supported" dialog on mobile and a Safari handoff
    everywhere else, which is the whole defect this slice removes. Null when the room URL is not a
    Foundry room URL, in which case the Teams-native button is not offered at all.
  */
  const trainingJoinToken = joinTokenFromParticipantUrl(event.join_url);
  const teamsDeepLink =
    trainingJoinToken && typeof window !== "undefined"
      ? buildTrainingDeepLink({ joinToken: trainingJoinToken, title: event.title, origin: window.location.origin })
      : null;
  const teamsNativeMessage = teamsDeepLink
    ? buildTrainingInviteMessage({ hostName: teamsHostName, title: event.title, deepLink: teamsDeepLink, locale })
    : null;
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

  /*
    SEND IN TEAMS — the Teams-native path. Never `teams.microsoft.com/share`, never a popup, never
    Safari: Teams' own people picker chooses the recipients and Teams' own chat opens with the
    invitation drafted. The Host presses Send; BTY never sends as them.

    Every non-composed outcome falls back to copying the PERSONAL-TAB DEEP LINK — not the raw web
    room URL. A Host who pastes the fallback into a chat is still delivering a Teams-native
    invitation.
  */
  const onSendInTeams = useCallback(async () => {
    if (!teamsNativeMessage || !teamsDeepLink) return;
    setSendState("choosing");
    setStatus(t.sendInTeamsChoosing);
    const outcome = await sendTrainingInTeams(teamsNativeMessage);
    setSendState("idle");

    if (outcome.k === "composed") {
      setTeamsState("idle");
      setStatus(t.sendInTeamsComposed);
      return;
    }
    if (outcome.k === "cancelled") {
      setTeamsState("idle");
      setStatus("");
      return;
    }
    const copied = await writeClipboard(teamsDeepLink);
    setTeamsState("fallback");
    setStatus(outcome.k === "unsupported" ? t.sendInTeamsUnsupported : t.sendInTeamsFailed);
    if (!copied) revealManual(teamsNativeMessage);
  }, [
    teamsNativeMessage,
    teamsDeepLink,
    writeClipboard,
    revealManual,
    t.sendInTeamsChoosing,
    t.sendInTeamsComposed,
    t.sendInTeamsUnsupported,
    t.sendInTeamsFailed,
  ]);

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

      {insideTeams && teamsNativeMessage ? (
        /*
          INSIDE TEAMS. One primary action, and the secondary copies the DEEP LINK rather than the
          web URL — inside Teams there is no reason to hand anyone a browser address.
        */
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onSendInTeams}
            disabled={sendState === "choosing"}
            aria-label={t.sendInTeams}
            data-testid="send-in-teams"
            className="w-full rounded-xl bg-[#C9A66B] px-4 py-3 text-sm font-semibold text-[#0B1F3A] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {sendState === "choosing" ? t.sendInTeamsChoosing : t.sendInTeams}
          </button>
          <button
            type="button"
            data-testid="copy-teams-link"
            onClick={() => {
              void (async () => {
                const ok = await writeClipboard(teamsDeepLink!);
                if (ok) flashCopied(t.teamsLinkCopied);
                else revealManual(teamsNativeMessage);
              })();
            }}
            className="w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06]"
          >
            {copyState === "copied" ? t.teamsLinkCopied : t.copyInvitation}
          </button>
        </div>
      ) : native ? (
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
            className="w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06]"
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
            className="flex-1 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/[0.07]"
          >
            {copyState === "copied" ? t.linkCopied : t.copyInvitation}
          </button>
          <button
            type="button"
            onClick={onShareTeams}
            aria-label={t.shareToTeams}
            className="flex-1 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.07]"
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
              className="rounded-lg border border-white/[0.12] px-3 py-2 text-xs text-white/80 hover:bg-white/[0.06]"
            >
              {t.copyInvitation}
            </button>
            {/*
              THE WEB SHARE PAGE IS NOT OFFERED INSIDE TEAMS. `teams.microsoft.com/share` is
              documented as unsupported on Teams mobile, and following it from the tab would leave
              Teams for a browser — the exact handoff this slice removes. Outside Teams it is
              unchanged.
            */}
            {insideTeams ? null : (
              <a
                href={teamsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/[0.12] px-3 py-2 text-xs text-white/70 hover:bg-white/[0.06]"
              >
                {t.openTeams}
              </a>
            )}
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
