"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Foundry Follow-up Response — the focused learner surface for a scheduled follow-up checkpoint
 * (Slice 3.1B-3K). Opened from the Today FOLLOW_UP_DUE reminder deep-link (?tab=foundry&followup=<id>)
 * and, once settled at a non-terminal answer, from My Learning (Slice 3.2R-R3-R1).
 * It does NOT reopen the training Room: it reads the caller's OWN obligation and lets them submit one
 * self-reported outcome. The outcome is learner-reported (never "verified") and is disclosed as shared
 * with the Host. Submitting NEVER awards XP or reopens the training. A not-owned/invalid id fails safe.
 *
 * A LATER CHECK-IN IS NOT AN EDIT (Slice 3.2R-R3-R1).
 *
 * This surface used to treat EVERY responded obligation as read-only, which made 3.2M-3's service
 * capability unreachable: a learner who truthfully answered "not yet" on day 7 could never come back
 * on day 14 and say they had done it. Now the prior answer stays on screen as a settled fact and a
 * SECOND question is asked underneath it — "what is true now?" — because the first answer was not
 * wrong, it was true then. Nothing is edited, replaced or corrected; the earlier report keeps its
 * place in the append-only audit trail, and APPLIED remains terminal.
 *
 * WHETHER THAT SECOND QUESTION APPEARS IS NOT DECIDED HERE. `canCheckInAgain` is computed
 * server-side by the same domain authority the write path consults, so this file cannot offer a
 * transition the server would refuse. A missing field is read as `false` — the conservative
 * direction, which can only ever hide the section.
 */

type Locale = "en" | "ko";

type Outcome = "APPLIED" | "PARTLY_APPLIED" | "NOT_YET" | "BLOCKED";

type Followup = {
  id: string;
  sourceTrainingTitle: string;
  followUpDays: number;
  dueAt: string;
  dueState: "due_today" | "overdue" | "upcoming" | "responded";
  status: "PENDING" | "RESPONDED";
  outcome: Outcome | null;
  respondedAt: string | null;
  expectedBehavior: string | null;
  /** Server-decided (Slice 3.2R-R3-R1). Absent → false; this surface never derives it. */
  canCheckInAgain?: boolean;
};

const COPY: Record<Locale, {
  back: string;
  checkpoint: (n: number) => string;
  dueToday: string;
  overdue: string;
  upcoming: string;
  prompt: string;
  expectedLabel: string;
  disclosure: string;
  choices: Record<Outcome, string>;
  submit: string;
  submitting: string;
  respondedLabel: string;
  selfReportNote: string;
  loadError: string;
  submitError: string;
  /** Slice 3.2R-R3-R1 — the later check-in. Never "edit", "correct" or "replace". */
  checkInAgainTitle: string;
  checkInAgainBody: string;
  earlierLabel: string;
}> = {
  en: {
    back: "← Back to Learn",
    checkpoint: (n) => `${n}-day follow-up`,
    dueToday: "Due today",
    overdue: "Overdue",
    upcoming: "Upcoming",
    prompt: "What happened when you tried this?",
    expectedLabel: "The training asked you to",
    disclosure: "Your follow-up status will be shared with the training host.",
    choices: {
      APPLIED: "I applied it",
      PARTLY_APPLIED: "I partly applied it",
      NOT_YET: "I have not tried it yet",
      BLOCKED: "Something blocked me",
    },
    submit: "Submit",
    submitting: "Submitting…",
    respondedLabel: "You reported",
    selfReportNote: "This is your own report, not verified behavior.",
    loadError: "This follow-up couldn’t be opened.",
    submitError: "That couldn’t be saved right now.",
    checkInAgainTitle: "Check in again",
    // Says what this is FOR, and protects the earlier answer in the same breath.
    checkInAgainBody: "Things change. If something has happened since, you can say so — your earlier answer stays as it was.",
    earlierLabel: "You reported earlier",
  },
  ko: {
    back: "← 학습으로 돌아가기",
    checkpoint: (n) => `${n}일 후 확인`,
    dueToday: "오늘 확인",
    overdue: "기한 지남",
    upcoming: "예정",
    prompt: "시도해보니 어떠셨나요?",
    expectedLabel: "교육에서 요청한 것",
    disclosure: "이 후속 확인 상태는 교육 담당자에게 공유됩니다.",
    choices: {
      APPLIED: "적용했습니다",
      PARTLY_APPLIED: "일부 적용했습니다",
      NOT_YET: "아직 시도하지 못했습니다",
      BLOCKED: "방해 요인이 있었습니다",
    },
    submit: "제출",
    submitting: "제출 중…",
    respondedLabel: "내가 보고한 결과",
    selfReportNote: "이것은 본인의 보고이며, 검증된 행동이 아닙니다.",
    loadError: "이 후속 확인을 열 수 없습니다.",
    submitError: "지금은 저장하지 못했습니다.",
    checkInAgainTitle: "다시 확인하기",
    checkInAgainBody: "상황은 달라집니다. 그 뒤에 무언가 있었다면 지금 알려주세요. 이전 답변은 그대로 남습니다.",
    earlierLabel: "이전에 보고한 결과",
  },
};

const OUTCOMES: Outcome[] = ["APPLIED", "PARTLY_APPLIED", "NOT_YET", "BLOCKED"];

function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function FoundryFollowUpResponse({
  followupId,
  locale,
  onBack,
}: {
  followupId: string;
  locale: string;
  onBack: () => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [followup, setFollowup] = useState<Followup | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const load = useCallback(async () => {
    try {
      const tz = deviceTz();
      const qs = tz ? `?tz=${encodeURIComponent(tz)}` : "";
      const res = await fetch(`/api/bty/foundry/followups/${encodeURIComponent(followupId)}${qs}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return setState("error");
      const data = (await res.json()) as { ok?: boolean; followup?: Followup };
      if (data?.ok && data.followup) {
        setFollowup(data.followup);
        setState("ready");
      } else setState("error");
    } catch {
      setState("error");
    }
  }, [followupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (outcome: Outcome) => {
      if (submitting) return;
      setSubmitting(true);
      setSubmitError(false);
      try {
        const res = await fetch(`/api/bty/foundry/followups/${encodeURIComponent(followupId)}/respond`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ outcome }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; outcome?: Outcome; error?: string; canCheckInAgain?: boolean }
          | null;
        /*
          The SERVER decides whether another check-in is still possible, on the write response as
          well as the read (Slice 3.2R-R3-R1). Deriving it here from the outcome just submitted
          would be the outcome policy living in React, and it would first drift at exactly the
          moment that matters: the tap that makes APPLIED terminal.
        */
        if (res.ok && data?.ok) {
          setFollowup((f) =>
            f
              ? { ...f, status: "RESPONDED", dueState: "responded", outcome, canCheckInAgain: data.canCheckInAgain === true }
              : f,
          );
        } else if (res.status === 409 && data?.outcome) {
          // A prior outcome already stands — never overwrite; show the settled one.
          setFollowup((f) =>
            f
              ? {
                  ...f,
                  status: "RESPONDED",
                  dueState: "responded",
                  outcome: data.outcome ?? f.outcome,
                  canCheckInAgain: data.canCheckInAgain === true,
                }
              : f,
          );
        } else {
          setSubmitError(true);
        }
      } catch {
        setSubmitError(true);
      } finally {
        setSubmitting(false);
      }
    },
    [followupId, submitting],
  );

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      data-testid="followup-back"
      className="self-start text-sm text-white/60 hover:text-white/90"
    >
      {t.back}
    </button>
  );

  if (state === "loading") {
    return (
      <div className="btyFadeIn flex flex-col gap-6">
        {backButton}
        <div aria-hidden className="min-h-[30vh]" />
      </div>
    );
  }
  if (state === "error" || !followup) {
    return (
      <div className="btyFadeIn flex flex-col gap-6" data-testid="followup-error">
        {backButton}
        <p className="text-sm leading-6 text-white/50">{t.loadError}</p>
      </div>
    );
  }

  const dueLabel =
    followup.dueState === "overdue" ? t.overdue : followup.dueState === "due_today" ? t.dueToday : t.upcoming;
  const dueTone =
    followup.dueState === "overdue"
      ? "border-red-400/30 text-red-300/80"
      : followup.dueState === "due_today"
        ? "border-[#C9A66B]/35 text-[#E5B769]"
        : "border-white/[0.12] text-white/50";
  const responded = followup.status === "RESPONDED";
  /*
    Server authority, read and not derived. `=== true` rather than a truthy test so an older
    payload without the field, or a shape that fails to parse, resolves to "no later check-in" —
    the direction that can only ever hide the section.
  */
  const canCheckIn = responded && followup.canCheckInAgain === true;

  /*
    ONE choice list, rendered by both the first response and the later check-in. Two copies would
    eventually disagree about which outcomes exist, and the settled answer is already shown above
    it in the check-in case, so the learner is never asked to pick blind.
  */
  const choiceList = (
    <div className="flex flex-col gap-2">
      {OUTCOMES.map((o) => (
        <button
          key={o}
          type="button"
          disabled={submitting}
          data-testid={`followup-choice-${o}`}
          onClick={() => submit(o)}
          className="w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-3 text-left text-[0.95rem] text-white/85 transition hover:border-[#C9A66B]/35 hover:bg-white/[0.06] disabled:opacity-60"
        >
          {t.choices[o]}
        </button>
      ))}
    </div>
  );

  return (
    <section className="btyFadeIn flex flex-col gap-6" data-testid="foundry-followup-response" data-status={followup.status}>
      {backButton}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90" data-testid="followup-checkpoint">
          {t.checkpoint(followup.followUpDays)}
        </span>
        <h1 className="text-xl font-semibold text-white/95">{followup.sourceTrainingTitle}</h1>
        {!responded ? (
          <span className={"inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-medium " + dueTone} data-testid="followup-due">
            {dueLabel}
          </span>
        ) : null}
      </div>

      {followup.expectedBehavior ? (
        <div className="flex flex-col gap-1" data-testid="followup-expected">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-white/40">{t.expectedLabel}</span>
          <p className="text-[0.95rem] leading-7 text-white/85">{followup.expectedBehavior}</p>
        </div>
      ) : null}

      {/*
        THE SETTLED ANSWER IS A FACT, NOT A FORM FIELD. It renders identically whether or not a
        later check-in is possible — only its label softens from "You reported" to "You reported
        earlier", because the answer below it is about to become the more recent one. It is never
        greyed, struck through, or presented as something to fix.
      */}
      {responded ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-5" data-testid="followup-settled">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-white/40">
            {canCheckIn ? t.earlierLabel : t.respondedLabel}
          </span>
          <p className="text-lg font-semibold text-white/90">
            {followup.outcome ? t.choices[followup.outcome] : ""}
          </p>
          <p className="text-xs leading-6 text-white/45">{t.selfReportNote}</p>
        </div>
      ) : null}

      {/*
        THE LATER CHECK-IN (Slice 3.2R-R3-R1). Rendered ONLY when the server says this obligation
        can still take one — so an APPLIED record reaches the block above and stops, exactly as it
        did before this slice existed.

        It asks a NEW question rather than reopening the old one. No free-text response, blocker or
        evidence field is added: those columns do not exist in this model, and inventing an input
        for one is how a second retention surface gets created by accident.
      */}
      {canCheckIn ? (
        <div className="flex flex-col gap-3" data-testid="followup-check-in-again">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-[#C9A66B]/90">
              {t.checkInAgainTitle}
            </span>
            <p className="text-xs leading-5 text-white/50">{t.checkInAgainBody}</p>
          </div>
          <p className="text-[1rem] font-medium leading-7 text-white/90">{t.prompt}</p>
          {choiceList}
          <p className="text-xs leading-5 text-white/45" data-testid="followup-disclosure">
            {t.disclosure}
          </p>
          {submitError ? <p className="text-xs leading-5 text-red-300/80" role="alert">{t.submitError}</p> : null}
        </div>
      ) : null}

      {!responded ? (
        <div className="flex flex-col gap-3">
          <p className="text-[1rem] font-medium leading-7 text-white/90">{t.prompt}</p>
          {choiceList}
          <p className="text-xs leading-5 text-white/45" data-testid="followup-disclosure">
            {t.disclosure}
          </p>
          {submitError ? <p className="text-xs leading-5 text-red-300/80" role="alert">{t.submitError}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
