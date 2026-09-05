"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EvidenceLevel } from "@/domain/foundry/module/program-authorship";
import { EVIDENCE_DISPLAY_ORDER, HOST_RUNG_LABEL } from "./evidenceLadderCopy";

/**
 * Host Shared Understanding review (Slice 3.1B-3G, CHECKPOINT 4).
 *
 * Renders ONLY when the event has a configured shared question AND at least one learner has actually
 * SUBMITTED a shared response (never a legacy "unreviewed backlog"). Shows each shared answer + a
 * review-status control (educational review, NOT a field-application proof and NOT an employee
 * score). NEVER shows private Reflection — the read endpoint does not return it.
 */

type Locale = "en" | "ko";
type ReviewStatus = "NOT_REVIEWED" | "ALIGNED" | "PARTIALLY_CLEAR" | "FOLLOW_UP_NEEDED";

type Response = {
  participantId: string;
  progressId: string;
  displayName: string;
  completed: boolean;
  sharedResponse: string | null;
  submittedAt: string | null;
  /** Slice 3.2M-1 — what the learner decided to do, in their own words. */
  decisionResponse: string | null;
  decisionSubmittedAt: string | null;
  /** Slice 3.2M-2 — did they rehearse it? `unattributable` = anonymous, so nobody can say. */
  practice?: "practised" | "not_practised" | "unattributable";
  /**
   * Slice 3.2R-R1 — how far evidence has progressed. Rung NAMES only; the API cannot return
   * learner text on this field, and the Host cannot reach the private reflection through it.
   */
  evidence?: { established?: EvidenceLevel[]; highestEstablished?: EvidenceLevel | null };
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
};

type View = { eventId: string; sharedQuestion: string | null; responses: Response[] };

const COPY: Record<Locale, {
  heading: string;
  framing: string;
  submitted: string;
  decisionHeading: string;
  practised: string;
  notPractised: string;
  practiceUnattributable: string;
  evidenceHeading: string;
  evidenceFraming: string;
  save: string;
  saving: string;
  notePlaceholder: string;
  statuses: Record<ReviewStatus, string>;
}> = {
  en: {
    heading: "Shared understanding",
    framing: "Educational review of the submitted response — not proof of field application, and not an employee performance score.",
    submitted: "Submitted",
    decisionHeading: "Their decision",
    practised: "Practised",
    notPractised: "Not practised yet",
    practiceUnattributable: "Joined without an account — practice can't be matched to them",
    evidenceHeading: "Evidence so far",
    evidenceFraming: "How far evidence has progressed — not a rating of this person. Private reflections are never shown here.",
    save: "Save review",
    saving: "Saving…",
    notePlaceholder: "Optional educational note…",
    statuses: {
      NOT_REVIEWED: "Not reviewed",
      ALIGNED: "Aligned with the training",
      PARTIALLY_CLEAR: "Partially clear",
      FOLLOW_UP_NEEDED: "Follow-up needed",
    },
  },
  ko: {
    heading: "공유 이해 확인",
    framing: "제출된 답변에 대한 교육적 검토입니다 — 현장 적용의 증거가 아니며, 직원 성과 점수가 아닙니다.",
    submitted: "제출",
    decisionHeading: "본인의 결정",
    practised: "연습함",
    notPractised: "아직 연습하지 않음",
    practiceUnattributable: "계정 없이 참여 — 연습 기록을 이 사람과 연결할 수 없습니다",
    evidenceHeading: "지금까지의 근거",
    evidenceFraming: "근거가 어디까지 진행되었는지를 보여줍니다 — 이 사람에 대한 평가가 아닙니다. 비공개 성찰은 여기에 표시되지 않습니다.",
    save: "검토 저장",
    saving: "저장 중…",
    notePlaceholder: "선택 교육 메모…",
    statuses: {
      NOT_REVIEWED: "검토 전",
      ALIGNED: "교육 기준과 일치",
      PARTIALLY_CLEAR: "일부 불명확",
      FOLLOW_UP_NEEDED: "후속 확인 필요",
    },
  },
};

const REVIEWABLE: ReviewStatus[] = ["ALIGNED", "PARTIALLY_CLEAR", "FOLLOW_UP_NEEDED"];

export default function FoundrySharedReview({
  eventId,
  locale,
  focusProgressId,
}: {
  eventId: string;
  locale: string;
  /** Host Leadership Attention deep link (Slice 3.1B-3L): scroll to + highlight this progress row. */
  focusProgressId?: string;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [view, setView] = useState<View | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Scroll the deep-linked row into view exactly once, then keep it highlighted. Presentation only.
  const scrolledRef = useRef(false);
  const setFocusEl = (el: HTMLLIElement | null) => {
    if (el && !scrolledRef.current) {
      scrolledRef.current = true;
      try {
        el.scrollIntoView({ block: "center" });
      } catch {
        /* non-DOM env — no-op */
      }
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bty/foundry/events/${encodeURIComponent(eventId)}/shared-understanding`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as (View & { ok?: boolean }) | null;
      if (data?.ok) setView({ eventId, sharedQuestion: data.sharedQuestion, responses: data.responses ?? [] });
      else setView(null);
    } catch {
      setView(null);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setReview = useCallback(
    async (participantId: string, status: ReviewStatus, note: string | null) => {
      setBusyId(participantId);
      try {
        const res = await fetch(
          `/api/bty/foundry/events/${encodeURIComponent(eventId)}/participants/${encodeURIComponent(participantId)}/review`,
          {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status, note }),
          },
        );
        const data = (await res.json()) as (View & { ok?: boolean }) | null;
        if (data?.ok) setView({ eventId, sharedQuestion: data.sharedQuestion, responses: data.responses ?? [] });
      } finally {
        setBusyId(null);
      }
    },
    [eventId],
  );

  /*
    Amendment E gated this on a configured shared question. Slice 3.2M-1 adds a second reason to
    show it: a learner may have recorded a DECISION in a training that asks no shared question.
    Either is worth the Host's attention; neither alone is.
  */
  const hasDecision = Boolean(view?.responses.some((r) => (r.decisionResponse ?? "").trim().length > 0));
  if (!view || view.responses.length === 0) return null;
  if (!view.sharedQuestion && !hasDecision) return null;

  return (
    <section data-testid="host-shared-review" className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div>
        <h3 className="text-sm font-semibold text-white/90">{t.heading}</h3>
        <p className="mt-1 text-xs leading-5 text-white/50" data-testid="review-framing">{t.framing}</p>
        {view.sharedQuestion ? <p className="mt-2 text-sm text-white/80">{view.sharedQuestion}</p> : null}
      </div>
      <ul className="flex flex-col gap-3">
        {view.responses.map((r) => {
          const isFocused = Boolean(focusProgressId) && r.progressId === focusProgressId;
          return (
          <li
            key={r.participantId}
            ref={isFocused ? setFocusEl : undefined}
            data-testid="shared-review-row"
            data-focused={isFocused ? "true" : undefined}
            className={
              "rounded-xl border bg-white/[0.02] p-3 " +
              (isFocused ? "border-[#C9A66B]/60 ring-2 ring-[#C9A66B]/40" : "border-white/[0.08]")
            }
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/90">{r.displayName}</span>
              <span className="text-[11px] text-white/40">
                {t.submitted}: {new Date(r.submittedAt ?? r.decisionSubmittedAt ?? Date.now()).toLocaleDateString()}
              </span>
            </div>
            {/* What the LEARNER decided — their own words, not the sentence BTY proposed. */}
            {(r.decisionResponse ?? "").trim().length > 0 ? (
              <div className="mt-2" data-testid="host-decision">
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#C9A66B]/85">{t.decisionHeading}</span>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/85" data-testid="host-decision-text">
                  {r.decisionResponse}
                </p>
              </div>
            ) : null}
            {/* Did they rehearse it? Product language only — never a rung name. */}
            {r.practice ? (
              <p className="mt-2 text-xs text-white/55" data-testid={`host-practice-${r.practice}`}>
                {r.practice === "practised" ? t.practised : r.practice === "not_practised" ? t.notPractised : t.practiceUnattributable}
              </p>
            ) : null}
            {(r.sharedResponse ?? "").trim().length > 0 ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/85">{r.sharedResponse}</p>
            ) : null}
            {/*
              EVIDENCE SO FAR (Slice 3.2R-R1). Rung names only — this block has no access to any
              learner text and renders none.

              ESTABLISHED RUNGS ONLY, for the same reason as the learner surface and on the
              authority of 3.2N: a training that published no observable standard has no
              observation path, so rendering a dim "Independently observed" would tell the Host
              this person was not seen, when nobody was ever authorised to look. The Host's
              question — how far has evidence progressed — is answered by what IS established.
            */}
            {(r.evidence?.established?.length ?? 0) > 0 ? (
              <div className="mt-3" data-testid="host-evidence">
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
                  {t.evidenceHeading}
                </span>
                <ul className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  {EVIDENCE_DISPLAY_ORDER.filter((level) => (r.evidence?.established ?? []).includes(level)).map(
                    (level) => (
                      <li
                        key={level}
                        data-testid={`host-evidence-rung-${level}`}
                        className="rounded-full bg-[#C9A66B]/[0.12] px-2 py-0.5 text-[11px] text-[#C9A66B]/95"
                      >
                        {HOST_RUNG_LABEL[loc][level]}
                      </li>
                    ),
                  )}
                </ul>
                <p className="mt-1.5 text-[10px] leading-4 text-white/35" data-testid="host-evidence-framing">
                  {t.evidenceFraming}
                </p>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {REVIEWABLE.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busyId === r.participantId}
                  onClick={() => setReview(r.participantId, s, r.reviewNote)}
                  data-testid={`review-status-${s}`}
                  aria-pressed={r.reviewStatus === s}
                  className={
                    "rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 " +
                    (r.reviewStatus === s
                      ? "border-[#C9A66B]/60 bg-[#C9A66B]/15 text-[#C9A66B]"
                      : "border-white/[0.12] bg-white/[0.03] text-white/70")
                  }
                >
                  {t.statuses[s]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-white/40" data-testid="current-status">
              {t.statuses[r.reviewStatus]}
            </p>
          </li>
          );
        })}
      </ul>
    </section>
  );
}
