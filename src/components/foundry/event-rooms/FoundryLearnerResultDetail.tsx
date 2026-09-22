"use client";
import { useCallback, useEffect, useState } from "react";
import type { EventRoomsCopy, Locale } from "./copy";
import { followUpDraft } from "@/domain/foundry/events/quizFollowUp";
import { openDirectChat } from "@/lib/bty/teams/openDirectChat";

/**
 * ONE LEARNER'S RESULT, AND THE WAY OUT OF IT. Slice Training Result → Human Teams Chat V1.
 *
 * ★ WHAT THIS SURFACE IS FOR. `4 / 5` tells a Host that something did not land, and nothing about
 * what. This shows the item that was missed and the answer the learner actually chose — a specific
 * thing two people can talk about — and puts the conversation one tap away. The score is the way
 * in, not the destination.
 *
 * ★ ONLY THE OBJECTIVE QUIZ IS SHOWN. The server projection carries the Host-authored questions
 * and the learner's multiple-choice selections, and has no field for learner prose. Private
 * Reflection is never Host-visible, and Shared Understanding has its own reviewed surface.
 *
 * ★ CORRECT ANSWERS ARE NOT LISTED. A Host deciding whether to reach out does not need the list of
 * things that went right, and showing it would bury the one thing that did not.
 */

type MissedQuestion = {
  questionId: string;
  text: string;
  selectedLabel: string | null;
  correctLabel: string;
  explanation: string | null;
};

type Detail = {
  displayName: string | null;
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  missed: MissedQuestion[];
  trainingTitle: string;
  canMessageInTeams: boolean;
};

export function FoundryLearnerResultDetail({
  eventId,
  participantId,
  locale,
  t,
  onBack,
}: {
  eventId: string;
  participantId: string;
  locale: Locale;
  t: EventRoomsCopy;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [chatState, setChatState] = useState<"idle" | "opening">("idle");
  const [chatNote, setChatNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setDetail(null);
    setFailed(false);
    void fetch(
      `/api/bty/foundry/events/${encodeURIComponent(eventId)}/quiz-results/${encodeURIComponent(participantId)}`,
      { credentials: "include", cache: "no-store" },
    )
      .then(async (r) => (r.ok ? ((await r.json()) as Detail) : null))
      .then((next) => {
        if (!live) return;
        if (next) setDetail(next);
        else setFailed(true);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [eventId, participantId]);

  /*
    THE HOST REMAINS THE SENDER. This resolves where the chat window points and records that the
    Host reached out; the draft is placed in the compose box for them to edit. BTY never sends it,
    and never learns what was finally said.
  */
  const onMessage = useCallback(async () => {
    if (!detail || chatState === "opening") return;
    setChatState("opening");
    setChatNote(null);
    try {
      const res = await fetch(
        `/api/bty/foundry/events/${encodeURIComponent(eventId)}/quiz-results/${encodeURIComponent(participantId)}/follow-up`,
        { method: "POST", credentials: "include", cache: "no-store" },
      );
      const body = (await res.json().catch(() => null)) as { chatTarget?: string; error?: string } | null;
      if (!res.ok || !body?.chatTarget) {
        setChatNote(body?.error === "no_teams_identity" ? t.messageInTeamsNoIdentity : t.messageInTeamsUnavailable);
        return;
      }
      const outcome = await openDirectChat(body.chatTarget, followUpDraft(detail.trainingTitle, locale));
      if (outcome.k !== "opened") setChatNote(t.messageInTeamsUnavailable);
    } catch {
      setChatNote(t.messageInTeamsUnavailable);
    } finally {
      setChatState("idle");
    }
  }, [detail, chatState, eventId, participantId, locale, t]);

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
      aria-label={t.resultDetailMissedHeader}
      data-testid="learner-result-detail"
    >
      <button
        type="button"
        onClick={onBack}
        data-testid="learner-result-back"
        className="self-start text-xs text-white/45 hover:text-white/70"
      >
        {t.resultDetailBack}
      </button>

      {failed ? <p className="text-sm text-white/60">{t.resultDetailUnavailable}</p> : null}
      {!detail && !failed ? <p className="text-sm text-white/45">{t.resultDetailLoading}</p> : null}

      {detail ? (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-white/85" data-testid="learner-result-name">
              {detail.displayName}
            </p>
            <p className="text-sm text-white/60" data-testid="learner-result-score">
              {detail.correctCount} / {detail.totalCount} · {detail.scorePercent}%
            </p>
          </div>

          {detail.missed.length === 0 ? (
            <p className="text-sm text-white/60">{t.resultDetailAllCorrect}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">
                {t.resultDetailMissedHeader}
              </p>
              <ul className="flex flex-col gap-3" data-testid="learner-result-missed">
                {detail.missed.map((question) => (
                  <li
                    key={question.questionId}
                    className="flex flex-col gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"
                  >
                    <p className="text-sm text-white/80">{question.text}</p>
                    <p className="text-xs text-white/50">
                      {t.resultDetailTheyChose}: {question.selectedLabel ?? t.resultDetailNoAnswer}
                    </p>
                    <p className="text-xs text-white/70">
                      {t.resultDetailCorrectAnswer}: {question.correctLabel}
                    </p>
                    {question.explanation ? (
                      <p className="text-xs leading-5 text-white/45">{question.explanation}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* A learner who joined on the web has no Teams coordinate, so the CTA is absent rather
              than present and failing on tap. */}
          {detail.canMessageInTeams ? (
            <button
              type="button"
              onClick={onMessage}
              disabled={chatState === "opening"}
              data-testid="message-in-teams"
              className="w-full rounded-xl bg-[#C9A66B] px-4 py-3 text-sm font-semibold text-[#0B1F3A] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {chatState === "opening" ? t.messageInTeamsOpening : t.messageInTeams}
            </button>
          ) : (
            <p className="text-xs text-white/45" data-testid="message-in-teams-absent">
              {t.messageInTeamsNoIdentity}
            </p>
          )}
          {chatNote ? (
            <p className="text-xs text-white/55" data-testid="message-in-teams-note">
              {chatNote}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
