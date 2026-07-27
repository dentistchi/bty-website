"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Reality Event — member scan flow (Slice 3.2D-EVENT V1). Reached by scanning a
 * canonical Event QR (a URL deep link `/{locale}/bty/events/scan?ev=<btyev1 token>`).
 * Deliberate confirm → POST /api/bty/events/scan { token } → the server verifies the
 * `btyev1` token, guards the event, and awards Core XP exactly once via
 * `bty_event_scan_award` (idempotent on (event_id, user_id)).
 *
 * Honesty invariants:
 *  - No local "verified" state before the server confirms (phase starts `idle`).
 *  - A repeat scan renders "Already recorded" with NO duplicate-XP implication.
 *  - Only XP the server returns is shown (never invented).
 *  - Result is derived only from the current POST (no cache) → account-isolated;
 *    a force-quit/relaunch re-derives from the server (never a stale fake success).
 *  - Event QR only: the token is posted to the Event scan endpoint; a wrong-family
 *    (`aalo1`) or malformed token is rejected server-side before any mutation.
 */

type Phase = "idle" | "loading" | "verified" | "already" | "error";
type ScanResult = { ok: boolean; already_scanned?: boolean; xp_awarded?: number; event?: { title?: string; event_type?: string }; newCoreTotal?: number; error?: string };

const COPY = {
  en: {
    heading: "Scan to participate",
    intro: "You scanned an event. Confirm to record your participation.",
    confirm: "Confirm participation",
    working: "Recording…",
    verifiedTitle: "Participation verified",
    verifiedBody: "Your participation was recorded.",
    alreadyTitle: "Already recorded",
    alreadyBody: "Your participation for this event is already recorded.",
    xp: (n: number) => `+${n} XP`,
    signIn: "Sign in to record participation",
    backToday: "Back to Today",
    errors: {
      invalid_qr: "This event QR is not valid.",
      invalid_token: "This event QR is not valid.",
      bad_signature: "This event QR is not valid.",
      invalid_payload: "This event QR is not valid.",
      expired: "This event has ended.",
      event_expired: "This event has ended.",
      event_cancelled: "This event was cancelled.",
      event_not_found: "This event could not be found.",
      server: "Something went wrong. Please try again.",
    } as Record<string, string>,
  },
  ko: {
    heading: "스캔하여 참여",
    intro: "이벤트를 스캔했습니다. 참여를 기록하려면 확인하세요.",
    confirm: "참여 확인",
    working: "기록 중…",
    verifiedTitle: "참여 확인됨",
    verifiedBody: "참여가 기록되었습니다.",
    alreadyTitle: "이미 기록됨",
    alreadyBody: "이 이벤트에 대한 참여가 이미 기록되어 있습니다.",
    xp: (n: number) => `+${n} XP`,
    signIn: "로그인하여 참여 기록",
    backToday: "오늘로 돌아가기",
    errors: {
      invalid_qr: "유효하지 않은 이벤트 QR입니다.",
      invalid_token: "유효하지 않은 이벤트 QR입니다.",
      bad_signature: "유효하지 않은 이벤트 QR입니다.",
      invalid_payload: "유효하지 않은 이벤트 QR입니다.",
      expired: "이 이벤트는 종료되었습니다.",
      event_expired: "이 이벤트는 종료되었습니다.",
      event_cancelled: "취소된 이벤트입니다.",
      event_not_found: "이벤트를 찾을 수 없습니다.",
      server: "문제가 발생했습니다. 다시 시도하세요.",
    } as Record<string, string>,
  },
};

export default function EventScanClient({ locale, token }: { locale: string; token: string }) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const hasToken = typeof token === "string" && token.trim().length > 0;

  async function confirmParticipation() {
    if (!hasToken) {
      setErrorReason("invalid_qr");
      setPhase("error");
      return;
    }
    setPhase("loading");
    setNeedsSignIn(false);
    try {
      const res = await fetch("/api/bty/events/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => ({}))) as ScanResult;
      if (res.status === 401) {
        // Unauthenticated → prompt sign-in (return here after login); token errors → invalid.
        if (data?.error === "UNAUTHENTICATED") {
          setNeedsSignIn(true);
          setPhase("idle");
          return;
        }
        setErrorReason(data?.error ?? "invalid_token");
        setPhase("error");
        return;
      }
      if (!res.ok || !data?.ok) {
        setErrorReason(data?.error ?? "server");
        setPhase("error");
        return;
      }
      setResult(data);
      setPhase(data.already_scanned ? "already" : "verified");
    } catch {
      setErrorReason("server");
      setPhase("error");
    }
  }

  const todayHref = `/${loc}/app?tab=today`;
  const signInHref = typeof window !== "undefined"
    ? `/${loc}/bty/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
    : `/${loc}/bty/login`;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-5 px-6 py-10 text-white" data-testid="event-scan">
      {phase === "verified" ? (
        <section className="flex flex-col items-center gap-2 text-center" data-testid="event-scan-verified">
          <span className="text-3xl">✅</span>
          <h1 className="text-xl font-semibold">{t.verifiedTitle}</h1>
          {result?.event?.title ? <p className="text-white/80">{result.event.title}</p> : null}
          {typeof result?.xp_awarded === "number" && result.xp_awarded > 0 ? (
            <p className="text-sm font-semibold text-[#E5B769]" data-testid="event-scan-xp">{t.xp(result.xp_awarded)}</p>
          ) : null}
          <p className="text-sm text-white/60">{t.verifiedBody}</p>
        </section>
      ) : phase === "already" ? (
        <section className="flex flex-col items-center gap-2 text-center" data-testid="event-scan-already">
          <span className="text-3xl">🔁</span>
          <h1 className="text-xl font-semibold">{t.alreadyTitle}</h1>
          {result?.event?.title ? <p className="text-white/80">{result.event.title}</p> : null}
          <p className="text-sm text-white/60">{t.alreadyBody}</p>
        </section>
      ) : phase === "error" ? (
        <section className="flex flex-col items-center gap-2 text-center" data-testid="event-scan-error">
          <span className="text-3xl">⚠️</span>
          <p className="text-white/80">{t.errors[errorReason ?? "server"] ?? t.errors.server}</p>
        </section>
      ) : (
        <section className="flex flex-col items-center gap-3 text-center" data-testid="event-scan-idle">
          <h1 className="text-xl font-semibold">{t.heading}</h1>
          <p className="text-sm text-white/60">{t.intro}</p>
          {needsSignIn ? (
            <Link href={signInHref} data-testid="event-scan-signin" className="rounded-full bg-[#C9A66B] px-6 py-2.5 text-sm font-semibold text-[#0B1F3A]">
              {t.signIn}
            </Link>
          ) : (
            <button
              type="button"
              onClick={confirmParticipation}
              disabled={phase === "loading" || !hasToken}
              data-testid="event-scan-confirm"
              className="rounded-full bg-[#C9A66B] px-6 py-2.5 text-sm font-semibold text-[#0B1F3A] disabled:opacity-50"
            >
              {phase === "loading" ? t.working : t.confirm}
            </button>
          )}
          {!hasToken ? <p className="text-xs text-white/40" data-testid="event-scan-notoken">{t.errors.invalid_qr}</p> : null}
        </section>
      )}

      <Link href={todayHref} data-testid="event-scan-today" className="text-xs font-medium text-white/45 hover:text-white/70">
        {t.backToday}
      </Link>
    </main>
  );
}
