"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { readContentType, isGuidanceContentType, type FoundryContentType } from "@/domain/foundry/events/content-type";
import { installParticipantSessionTransport } from "@/lib/bty/foundry/events/participantSessionTransport";
import type { SavedLocale } from "@/lib/localePreference";

/**
 * THE TRAINING, RENDERED INSIDE THE BTY APP SHELL. Slice Teams-Native Delivery V1.
 *
 * ONE LEARNER RUNTIME, TWO DOORS. The public door is `/f/<token>`, for QR and external
 * participation, and it is untouched. The Teams door is `/teams` + a personal-tab `subPageId`,
 * and it lands here. Both render the SAME three clients — `FoundryJoinClient` (video),
 * `FoundryDocumentClient` (PDF) and `FoundryGuidanceClient` (text / discussion) — so video, PDF,
 * text, quiz, score and completion are one implementation with one set of rules. There is no
 * second quiz engine and no second completion path.
 *
 * WHAT THIS COMPONENT ADDS, AND NOTHING MORE:
 *
 *   1. It asks the server to open the room AS THIS ACCOUNT (`/api/bty/foundry/teams/room/open`),
 *      which resolves-or-creates the participant by (event, canonical user). The learner is never
 *      asked who they are: Teams already answered that, and the display label is resolved
 *      server-side from provider-written identity data.
 *
 *   2. It installs the participant-session transport for the duration, because the per-event
 *      cookie the public path relies on cannot travel in a third-party frame.
 *
 *   3. It gives the terminal an IN-SHELL way out, so finishing a training does not end in Safari.
 *
 * THE DOCUMENT NEVER CHANGES. Nothing here navigates, opens a link, or touches the URL — the tab
 * stays on `/teams` throughout, which is what keeps the Teams framing and session model valid.
 */

/*
  The three clients are heavy (a PDF reader, a YouTube player) and only one of them is ever needed.
  Loading them lazily keeps the shell's first paint unchanged for the many sessions that never open
  a training. `ssr: false` because they are browser-only room runtimes.
*/
const FoundryJoinClient = dynamic(() => import("@/app/f/[token]/FoundryJoinClient"), { ssr: false });
const FoundryDocumentClient = dynamic(() => import("@/app/f/[token]/FoundryDocumentClient"), { ssr: false });
const FoundryGuidanceClient = dynamic(() => import("@/app/f/[token]/FoundryGuidanceClient"), { ssr: false });

const COPY = {
  en: {
    opening: "Opening your training…",
    unavailable: "This training can't be opened right now.",
    notSignedIn: "Sign in to BTY to open this training.",
    closed: "This training is no longer open.",
    back: "Back to Learn",
  },
  ko: {
    opening: "훈련을 여는 중…",
    unavailable: "지금은 이 훈련을 열 수 없습니다.",
    notSignedIn: "이 훈련을 열려면 BTY에 로그인하세요.",
    closed: "이 훈련은 더 이상 열려 있지 않습니다.",
    back: "배우기로 돌아가기",
  },
} as const;

type OpenState =
  | { k: "opening" }
  | { k: "ready"; joinToken: string; contentType: FoundryContentType; session: string }
  | { k: "failed"; message: string };

export default function InShellLearnerRoom({
  target,
  locale,
  onExit,
}: {
  /** The parsed deep-link target's join token. Never a route, never an event id. */
  joinTokenTarget?: never;
  target: { joinToken: string };
  locale: "en" | "ko";
  onExit: () => void;
}) {
  const t = COPY[locale];
  const [state, setState] = useState<OpenState>({ k: "opening" });
  /** Read through a getter by the transport, so it is never captured stale. */
  const sessionRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  /*
    THE TRANSPORT IS INSTALLED BEFORE THE ROOM MOUNTS, not inside it. The clients begin fetching on
    their first effect, so a transport installed by the child would miss the first call — the very
    call that decides whether the learner is recognised or shown a join screen.
  */
  useEffect(() => {
    const uninstall = installParticipantSessionTransport(target.joinToken, () => sessionRef.current);
    return uninstall;
  }, [target.joinToken]);

  const open = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/foundry/teams/room/open", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: `foundry-training:${target.joinToken}` }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; joinToken: string; contentType: string; participantSession: string }
        | { ok: false; error?: string }
        | null;

      if (!res.ok || !data || !("ok" in data) || !data.ok) {
        const reason = (data && "error" in data ? data.error : undefined) ?? "unavailable";
        setState({
          k: "failed",
          message:
            reason === "unauthenticated"
              ? t.notSignedIn
              : reason === "event_closed" || reason === "removed"
                ? t.closed
                : t.unavailable,
        });
        return;
      }

      const contentType = readContentType(data.contentType);
      if (contentType === null) {
        setState({ k: "failed", message: t.unavailable });
        return;
      }
      // In memory only. Never written to storage, the URL, or a cookie.
      sessionRef.current = data.participantSession;
      setState({ k: "ready", joinToken: data.joinToken, contentType, session: data.participantSession });
    } catch {
      setState({ k: "failed", message: t.unavailable });
    }
  }, [target.joinToken, t]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void open();
  }, [open]);

  const exitAction = useMemo(() => ({ label: t.back, run: onExit }), [t.back, onExit]);
  const savedLocale = locale as SavedLocale;

  if (state.k === "ready") {
    if (state.contentType === "document") {
      return (
        <FoundryDocumentClient token={state.joinToken} savedLocale={savedLocale} onExit={exitAction} />
      );
    }
    if (isGuidanceContentType(state.contentType)) {
      return (
        <FoundryGuidanceClient
          token={state.joinToken}
          contentType={state.contentType}
          savedLocale={savedLocale}
          onExit={exitAction}
        />
      );
    }
    return <FoundryJoinClient token={state.joinToken} savedLocale={savedLocale} onExit={exitAction} />;
  }

  return (
    <main
      data-testid="in-shell-room-gate"
      data-phase={state.k}
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center text-white"
    >
      <p className="text-sm text-white/70">{state.k === "opening" ? t.opening : state.message}</p>
      {state.k === "failed" ? (
        <button
          type="button"
          onClick={onExit}
          data-testid="in-shell-room-back"
          className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/85"
        >
          {t.back}
        </button>
      ) : null}
    </main>
  );
}
