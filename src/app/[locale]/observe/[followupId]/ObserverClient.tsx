"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/components/foundry/event-rooms/copy";

/**
 * THE OBSERVER'S PAGE (Slice 3.2M-5).
 *
 * One question, asked plainly: did you personally see or hear this, and when? Nothing else is
 * requested, because nothing else is evidence. The observer is never asked to judge intent,
 * attitude, effort, competence or improvement — that would be a performance rating wearing an
 * evidence label, and it is not what this page is for.
 *
 * WHAT IS DELIBERATELY ABSENT: the learner's private reflection, their recorded decision, their
 * own follow-up report, their Arena history, any other participant, any raw id, the authority
 * edge, and every word of evidence-ladder vocabulary. An observer who has read the learner's
 * own claim is no longer an independent source, and a colleague asked to fill in a rung is
 * being asked to do something other than remember.
 *
 * The page can be returned to. There is no "done" state that closes it: a colleague who saw the
 * behaviour again next month picks the date and reports it, and only the identical (date,
 * answer) episode is treated as a double tap.
 */
type Outcome = "OBSERVED" | "NOT_OBSERVED" | "UNABLE_TO_TELL";

type ObservationRequest = {
  followupId: string;
  learnerDisplayName: string;
  observableStandard: string;
  maxObservedOn: string;
  myObservations: { outcome: Outcome; observedOn: string; submittedAt: string }[];
};

const COPY: Record<
  Locale,
  {
    heading: string;
    whoLabel: string;
    someone: string;
    watchLabel: string;
    whenLabel: string;
    askLabel: string;
    answers: Record<Outcome, string>;
    priorHeading: string;
    saving: string;
    saved: string;
    alreadyRecorded: string;
    unavailable: string;
    loadError: string;
    futureDate: string;
    submitError: string;
    privacyNote: string;
    back: string;
  }
> = {
  en: {
    heading: "A quick question",
    whoLabel: "Who",
    someone: "Your colleague",
    watchLabel: "What to watch for",
    whenLabel: "When did you see or hear this?",
    askLabel: "Did you personally see or hear this?",
    answers: {
      OBSERVED: "Yes — I saw or heard this",
      NOT_OBSERVED: "I didn't observe this",
      UNABLE_TO_TELL: "I couldn't tell",
    },
    priorHeading: "Your previous reports",
    saving: "Saving…",
    saved: "Thank you — recorded.",
    alreadyRecorded: "You already reported that for this date.",
    unavailable: "There's nothing here for you to answer.",
    loadError: "Couldn't load this right now.",
    futureDate: "Please choose a date that has already happened.",
    submitError: "That didn't save. Tap your answer once more.",
    back: "Back",
    privacyNote: "Only what you report here is recorded. Nothing you write elsewhere is shown to you here.",
  },
  ko: {
    heading: "짧은 질문 하나",
    whoLabel: "대상",
    someone: "동료",
    watchLabel: "무엇을 볼지",
    whenLabel: "언제 보거나 들으셨나요?",
    askLabel: "직접 보거나 들으셨나요?",
    answers: {
      OBSERVED: "네 — 직접 보거나 들었습니다",
      NOT_OBSERVED: "관찰하지 못했습니다",
      UNABLE_TO_TELL: "판단할 수 없었습니다",
    },
    priorHeading: "이전에 보고한 내용",
    saving: "저장 중…",
    saved: "감사합니다 — 기록되었습니다.",
    alreadyRecorded: "해당 날짜에 대해 이미 같은 내용을 보고하셨습니다.",
    unavailable: "여기서 답변하실 내용이 없습니다.",
    loadError: "지금은 불러올 수 없습니다.",
    futureDate: "이미 지난 날짜를 선택해 주세요.",
    submitError: "저장하지 못했습니다. 다시 시도해 주세요.",
    privacyNote: "여기서 보고하신 내용만 기록됩니다.",
    back: "뒤로",
  },
};

const ANSWER_ORDER: Outcome[] = ["OBSERVED", "NOT_OBSERVED", "UNABLE_TO_TELL"];

function fmtDay(dayKey: string, locale: Locale): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!m) return dayKey;
  // Formatted from the day key itself in UTC, so the displayed date is the date that was
  // reported — never shifted into the reader's zone.
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString(
    locale === "ko" ? "ko-KR" : "en-US",
    { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" },
  );
}

export default function ObserverClient({ followupId, locale }: { followupId: string; locale: Locale }) {
  const t = COPY[locale];
  const router = useRouter();
  /**
   * AN EXPLICIT WAY OUT (Slice 3.2N). BTY runs inside a WKWebView in the native shell, where
   * there is no browser chrome and therefore no back button — a page whose only exit is the
   * browser's is a dead end there. Returns to Practice, which is where the reviewer surface that
   * now links here lives; harmless for someone who arrived by URL.
   */
  const back = (
    <button
      type="button"
      onClick={() => router.push(`/${locale}/app?tab=practice`)}
      data-testid="observe-back"
      className="self-start text-xs text-white/45"
    >
      ← {t.back}
    </button>
  );
  const [req, setReq] = useState<ObservationRequest | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [observedOn, setObservedOn] = useState("");
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bty/foundry/observations/${encodeURIComponent(followupId)}`, {
        cache: "no-store",
      });
      if (res.status === 404 || res.status === 409) {
        setPhase("unavailable");
        return;
      }
      if (!res.ok) {
        setPhase("error");
        return;
      }
      const body = (await res.json()) as { ok: boolean; request?: ObservationRequest };
      if (!body.ok || !body.request) {
        setPhase("unavailable");
        return;
      }
      setReq(body.request);
      // Default to today in the canonical frame — the commonest truthful answer, and never a
      // date the server would refuse.
      setObservedOn((prev) => prev || body.request!.maxObservedOn);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [followupId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(outcome: Outcome) {
    if (!req || busy) return;
    setBusy(outcome);
    setNotice(null);
    try {
      const res = await fetch(`/api/bty/foundry/observations/${encodeURIComponent(followupId)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, observedOn }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; created?: boolean; error?: string };
      if (res.ok && body.ok) {
        setNotice(body.created ? t.saved : t.alreadyRecorded);
        await load();
      } else if (body.error === "future_date" || body.error === "invalid_date") {
        setNotice(t.futureDate);
      } else {
        setNotice(t.submitError);
      }
    } catch {
      setNotice(t.submitError);
    } finally {
      setBusy(null);
    }
  }

  if (phase === "loading") {
    return <main className="min-h-screen bg-[#0B1220] px-5 py-10 text-sm text-white/50">…</main>;
  }
  if (phase === "unavailable" || phase === "error") {
    return (
      <main className="min-h-screen bg-[#0B1220] px-5 py-10">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          {back}
          <p className="text-sm text-white/55" data-testid="observe-unavailable">
            {phase === "unavailable" ? t.unavailable : t.loadError}
          </p>
        </div>
      </main>
    );
  }

  const r = req!;
  return (
    <main className="min-h-screen bg-[#0B1220] px-5 py-10 text-white">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        {back}
        <h1 className="text-lg font-medium text-white/90">{t.heading}</h1>

        <section className="flex flex-col gap-1">
          <span className="text-[0.68rem] uppercase tracking-wide text-white/40">{t.whoLabel}</span>
          <span className="text-sm text-white/85" data-testid="observe-who">
            {r.learnerDisplayName || t.someone}
          </span>
        </section>

        {/* The frozen standard, verbatim. Never paraphrased — they attest to this sentence. */}
        <section className="flex flex-col gap-1">
          <span className="text-[0.68rem] uppercase tracking-wide text-white/40">{t.watchLabel}</span>
          <span className="text-sm leading-6 text-[#C9A66B]/90" data-testid="observe-standard">
            {r.observableStandard}
          </span>
        </section>

        <section className="flex flex-col gap-2">
          <label className="text-[0.68rem] uppercase tracking-wide text-white/40" htmlFor="observed-on">
            {t.whenLabel}
          </label>
          <input
            id="observed-on"
            type="date"
            value={observedOn}
            max={r.maxObservedOn}
            onChange={(e) => setObservedOn(e.target.value)}
            data-testid="observe-date"
            className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90"
          />
        </section>

        <section className="flex flex-col gap-2">
          <span className="text-[0.68rem] uppercase tracking-wide text-white/40">{t.askLabel}</span>
          {ANSWER_ORDER.map((o) => (
            <button
              key={o}
              type="button"
              disabled={busy !== null || !observedOn}
              onClick={() => void submit(o)}
              data-testid={`observe-answer-${o}`}
              className="rounded-md border border-white/15 bg-white/5 px-4 py-3 text-left text-sm text-white/85 disabled:opacity-50"
            >
              {busy === o ? t.saving : t.answers[o]}
            </button>
          ))}
        </section>

        {notice ? (
          <p className="text-xs text-white/60" data-testid="observe-notice">
            {notice}
          </p>
        ) : null}

        {/*
          Their own reports only — enough to avoid reporting the same day twice, and never a
          window onto anyone else's answer.
        */}
        {r.myObservations.length > 0 ? (
          <section className="flex flex-col gap-1 border-t border-white/10 pt-4">
            <span className="text-[0.68rem] uppercase tracking-wide text-white/40">{t.priorHeading}</span>
            {r.myObservations.map((o) => (
              <span key={`${o.observedOn}-${o.outcome}`} className="text-xs text-white/55" data-testid="observe-prior">
                {fmtDay(o.observedOn, locale)} — {t.answers[o.outcome]}
              </span>
            ))}
          </section>
        ) : null}

        <p className="text-[0.68rem] leading-5 text-white/35">{t.privacyNote}</p>
      </div>
    </main>
  );
}
