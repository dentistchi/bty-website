"use client";
import { useEffect, useState } from "react";
import type { EventRoomsCopy, Locale } from "./copy";
import { FoundryLearnerResultDetail } from "./FoundryLearnerResultDetail";

/**
 * THE HOST'S QUIZ ROSTER — and the way into one learner's result.
 *
 * Each scored row is a CONTROL, not a line of text: tapping it opens what the score cannot say,
 * which is the item that did not land. That is the whole point of the surface — a Host reads `4/5`
 * and needs to know what to talk about, not a better number.
 *
 * The detail replaces the list IN PLACE. This surface lives inside the app shell, so a row is a
 * shell command with a callback, never a link that navigates away from the control room.
 */
export function FoundryQuizResults({
  eventId,
  participantIds,
  locale,
  t,
}: {
  eventId: string;
  participantIds: { id: string; display_name: string }[];
  locale: Locale;
  t: EventRoomsCopy;
}) {
  const [data, setData] = useState<{
    submitted: number;
    averageScore: number | null;
    byParticipant: Record<string, { correctCount: number; totalCount: number }>;
  } | null>(null);
  const [openParticipantId, setOpenParticipantId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetch(`/api/bty/foundry/events/${encodeURIComponent(eventId)}/quiz-results`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((next) => {
        if (live) setData(next);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [eventId]);

  if (!data) return null;

  if (openParticipantId) {
    return (
      <FoundryLearnerResultDetail
        eventId={eventId}
        participantId={openParticipantId}
        locale={locale}
        t={t}
        onBack={() => setOpenParticipantId(null)}
      />
    );
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">{t.quizHeader}</p>
      <p className="text-sm text-white/75">
        {t.quizProgress(data.submitted, participantIds.length)}
        {data.averageScore !== null ? t.quizAverage(data.averageScore) : ""}
      </p>
      {participantIds.map((participant) => {
        const score = data.byParticipant[participant.id];
        if (!score) return null;
        return (
          <button
            key={participant.id}
            type="button"
            onClick={() => setOpenParticipantId(participant.id)}
            data-testid={`quiz-result-row-${participant.id}`}
            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-white/65 transition-colors hover:bg-white/[0.04]"
          >
            <span>
              {participant.display_name} · {score.correctCount} / {score.totalCount} ·{" "}
              {Math.round((score.correctCount * 100) / score.totalCount)}%
            </span>
            <span aria-hidden className="text-white/30">
              ›
            </span>
          </button>
        );
      })}
    </section>
  );
}
