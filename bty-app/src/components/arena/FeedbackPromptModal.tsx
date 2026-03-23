"use client";

/**
 * Pending scenario feedback prompt — overlay above {@link ScenarioSessionShell}; GET `/api/arena/session/feedback-prompt`,
 * POST `/api/arena/session/feedback` or defer. Emits `feedback_submitted` after successful submit for pattern/context refresh.
 */

import React from "react";
import type { FeedbackPrompt } from "@/engine/scenario/scenario-feedback.service";

export const FEEDBACK_SUBMITTED_EVENT = "feedback_submitted" as const;

export type FeedbackSubmittedDetail = {
  userId: string;
  scenarioId: string;
  queueId: string;
};

type FeedbackPromptApi = {
  ok?: boolean;
  prompt?: FeedbackPrompt | null;
  error?: string;
};

function dispatchFeedbackSubmitted(detail: FeedbackSubmittedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FEEDBACK_SUBMITTED_EVENT, { detail }));
}

export type FeedbackPromptModalProps = {
  userId: string | null;
  locale: "ko" | "en";
  /** Bump to refetch prompt (e.g. after new enqueue from summary). */
  refetchKey: number;
};

const MIN_CHARS = 50;

export function FeedbackPromptModal({ userId, locale, refetchKey }: FeedbackPromptModalProps) {
  const [prompt, setPrompt] = React.useState<FeedbackPrompt | null>(null);
  const [draft, setDraft] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [deferring, setDeferring] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!userId) {
      setPrompt(null);
      return;
    }
    setError(null);
    try {
      const fpRes = await fetch("/api/arena/session/feedback-prompt", { credentials: "include" });
      const fpJson = (await fpRes.json().catch(() => ({}))) as FeedbackPromptApi;
      if (fpRes.ok && fpJson.ok) {
        setPrompt(fpJson.prompt ?? null);
        setDraft("");
      } else {
        setPrompt(null);
      }
    } catch {
      setPrompt(null);
    }
  }, [userId]);

  React.useEffect(() => {
    void load();
  }, [load, refetchKey]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt || submitting || !userId) return;
    const text = draft.trim();
    if (text.length < MIN_CHARS) {
      setError(locale === "ko" ? `최소 ${MIN_CHARS}자 이상 입력해 주세요.` : `Please enter at least ${MIN_CHARS} characters.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/arena/session/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: prompt.scenarioId,
          responseText: text,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(
          data.error === "response_too_short"
            ? locale === "ko"
              ? `최소 ${MIN_CHARS}자 이상 입력해 주세요.`
              : `At least ${MIN_CHARS} characters required.`
            : data.error ?? "Failed to send.",
        );
        return;
      }
      setPrompt(null);
      setDraft("");
      dispatchFeedbackSubmitted({
        userId,
        scenarioId: prompt.scenarioId,
        queueId: prompt.queueId,
      });
    } catch {
      setError(locale === "ko" ? "연결 오류." : "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const onSkip = async () => {
    if (!prompt || deferring) return;
    setDeferring(true);
    setError(null);
    try {
      const res = await fetch("/api/arena/session/feedback-defer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueId: prompt.queueId }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !data.ok) {
        setError(locale === "ko" ? "나중에 하기 처리에 실패했습니다." : "Could not defer.");
        return;
      }
      setPrompt(null);
      setDraft("");
      await load();
    } catch {
      setError(locale === "ko" ? "연결 오류." : "Network error.");
    } finally {
      setDeferring(false);
    }
  };

  if (!prompt) return null;

  const labelKo = prompt.promptKo;
  const labelEn = prompt.promptEn;
  const flagLabel =
    prompt.flagType === "HERO_TRAP"
      ? locale === "ko"
        ? "히어로 트랩"
        : "Hero trap"
      : locale === "ko"
        ? "무결성 이탈"
        : "Integrity slip";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-prompt-title"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg rounded-2xl border border-amber-300/60 bg-amber-50/95 p-5 shadow-xl text-[var(--arena-text,#0f172a)]"
      >
        <p id="feedback-prompt-title" className="m-0 text-xs font-semibold uppercase tracking-wide text-amber-900/80">
          {locale === "ko" ? "이전 플레이 성찰" : "Reflection on your last choice"}
        </p>
        <p className="mt-1 m-0 text-xs text-amber-900/70">
          {locale === "ko" ? "시나리오" : "Scenario"}:{" "}
          <span className="font-mono text-[11px]">{prompt.scenarioId}</span>
          {" · "}
          {flagLabel}
        </p>
        <p className="mt-3 m-0 text-sm leading-relaxed">{locale === "ko" ? labelKo : labelEn}</p>
        <textarea
          className="mt-3 w-full min-h-[100px] rounded-lg border border-[var(--arena-text-soft,#64748b)]/25 bg-[var(--arena-bg,#fff)] p-3 text-sm"
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          disabled={submitting || deferring}
          aria-label={locale === "ko" ? "성찰 입력" : "Reflection"}
          aria-describedby="feedback-min-hint"
        />
        <p id="feedback-min-hint" className="mt-1 m-0 text-xs text-amber-900/60">
          {locale === "ko" ? `최소 ${MIN_CHARS}자` : `Minimum ${MIN_CHARS} characters`} · {draft.trim().length}{" "}
          {locale === "ko" ? "자" : "chars"}
        </p>
        {error ? (
          <p className="mt-2 m-0 text-xs text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={submitting || deferring || draft.trim().length < MIN_CHARS}
            className="rounded-lg bg-[var(--arena-accent,#0ea5e9)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? (locale === "ko" ? "보내는 중…" : "Sending…") : locale === "ko" ? "보내기" : "Send"}
          </button>
          <button
            type="button"
            disabled={submitting || deferring}
            onClick={() => void onSkip()}
            className="rounded-lg border border-amber-800/30 bg-white/80 px-4 py-2 text-sm font-semibold text-amber-950/90 disabled:opacity-50"
          >
            {deferring ? (locale === "ko" ? "처리 중…" : "…") : locale === "ko" ? "나중에 하기" : "Remind me later"}
          </button>
        </div>
      </form>
    </div>
  );
}
