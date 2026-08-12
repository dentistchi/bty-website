"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import {
  mapAnswersToJourney,
  isJourneyApprovable,
  type RealityGroundedJourneyV1,
  type JourneyElementKind,
} from "@/domain/foundry/module/journey";
import { attributionKind } from "@/domain/foundry/module/program-authorship";

/**
 * Host Learner Preview + Approval gate (Slice 3.2C-B3A).
 *
 * For a Journey-enabled draft this REPLACES the configuration-only review with the
 * actual ordered experience the LEARNER will receive: the participant title + each
 * grounded Journey element, showing which Host statement grounded it and flagging
 * any needs_confirmation. The Host may edit participant-facing content (an edit is
 * the Host's own statement → grounded on save) and must confirm the learner title.
 * Final creation is blocked while anything remains needs_confirmation (enforced
 * here for UX and re-enforced server-side at publish). Deterministic — no LLM.
 */

const KIND_LABEL: Record<JourneyElementKind, string> = {
  why_it_matters: "Why this matters",
  observable_standard: "The standard",
  scenario: "In context",
  reflection: "Reflect",
  action_decision: "Your decision",
  field_application: "Apply it",
  evidence: "What success looks like",
  completion_check: "Before you finish",
  follow_up: "What happens next",
};

const FIELD_LABEL: Record<string, string> = {
  problem: "What keeps going wrong",
  recurringMoment: "at each handoff point",
  observableBehavior: "Expected behavior",
  successEvidence: "Success evidence",
  sharedQuestion: "Shared question",
  completionPrompt: "Completion question",
};

/**
 * Honest authorship attribution. Saying "From your: …" over a sentence BTY authored is
 * the specific dishonesty Slice 3.2L closes, so the label is driven by the element's
 * recorded provenance, never assumed.
 */
function ProvenanceLabel({
  kind,
  attribution,
  field,
}: {
  kind: JourneyElementKind;
  attribution: ReturnType<typeof attributionKind>;
  field: string | undefined;
}) {
  const text =
    attribution === "bty_authored"
      ? "Drafted by BTY"
      : attribution === "host_edited"
        ? "Your edit"
        : attribution === "derived"
          ? "From your setup"
          : `From your: ${field ? (FIELD_LABEL[field] ?? field) : "input"}`;
  return (
    <span className="text-[0.66rem] text-white/35" data-testid={`journey-grounded-${kind}`} data-provenance={attribution ?? "unknown"}>
      {text}
    </span>
  );
}

export function JourneyPreview({
  answers,
  onPatch,
  onApprovableChange,
}: {
  answers: BuilderAnswers;
  /** Persist a partial answers update (merged + saved) — same seam the Builder uses. */
  onPatch: (partial: BuilderAnswers, immediate: boolean) => void;
  onApprovableChange: (approvable: boolean) => void;
}) {
  // Derive once from the raw reality if no Host-owned Journey exists yet; otherwise
  // the persisted (possibly edited) Journey is authoritative.
  const initial = useMemo<RealityGroundedJourneyV1>(
    () => answers.realityGroundedJourneyV1 ?? mapAnswersToJourney(answers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [journey, setJourney] = useState<RealityGroundedJourneyV1>(initial);
  const [titleDraft, setTitleDraft] = useState(initial.displayTitle);

  // Make the draft Journey-enabled on first preview (persist the derived Journey)
  // so publish uses the approved contract, not the legacy raw fields.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (answers.realityGroundedJourneyV1 === undefined) onPatch({ realityGroundedJourneyV1: initial }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onApprovableChange(isJourneyApprovable(journey));
  }, [journey, onApprovableChange]);

  const persist = useCallback(
    (next: RealityGroundedJourneyV1) => {
      setJourney(next);
      onPatch({ realityGroundedJourneyV1: next }, true);
    },
    [onPatch],
  );

  const editElement = useCallback(
    (id: string, content: string) => {
      persist({
        ...journey,
        elements: journey.elements.map((e) =>
          e.id === id
            ? {
                ...e,
                content,
                // A Host edit is the Host's own statement → grounded once non-empty.
                confirmationStatus: content.trim().length > 0 ? "grounded" : "needs_confirmation",
                grounding: content.trim().length > 0 ? [{ sourceType: "host_statement", field: e.grounding[0]?.field ?? "problem" }] : [],
              }
            : e,
        ),
      });
    },
    [journey, persist],
  );

  const confirmTitle = useCallback(() => {
    const t = titleDraft.trim();
    if (!t) return;
    persist({ ...journey, displayTitle: t, displayTitleStatus: "grounded" });
  }, [journey, persist, titleDraft]);

  return (
    <section className="flex flex-col gap-5" data-testid="journey-preview">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">Learner preview</span>
        <p className="text-sm leading-6 text-white/55">This is exactly what your team will experience. Everything below comes from what you wrote.</p>
      </div>

      {/* Participant title — must be Host-approved (never silently the raw problem line). */}
      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" data-testid="journey-title">
        <span className="text-xs uppercase tracking-[0.12em] text-white/40">Learner title</span>
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          data-testid="journey-title-input"
          className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-base text-white/90"
        />
        {journey.displayTitleStatus === "needs_confirmation" || titleDraft.trim() !== journey.displayTitle ? (
          <button
            type="button"
            onClick={confirmTitle}
            disabled={!titleDraft.trim()}
            data-testid="journey-title-confirm"
            className="self-start rounded-lg bg-[#C9A66B] px-4 py-1.5 text-sm font-semibold text-[#0B1F3A] disabled:opacity-60"
          >
            Confirm title
          </button>
        ) : (
          <span className="text-xs text-emerald-300/80" data-testid="journey-title-ok">Approved</span>
        )}
      </div>

      {journey.elements.map((el) => {
        const needs = el.confirmationStatus === "needs_confirmation";
        const field = el.grounding[0]?.field;
        return (
          <div key={el.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" data-testid={`journey-preview-el-${el.kind}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C9A66B]/85">{KIND_LABEL[el.kind]}</span>
              {needs ? (
                <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-amber-200/90" data-testid={`journey-needs-${el.kind}`}>
                  Needs confirmation
                </span>
              ) : (
                <ProvenanceLabel kind={el.kind} attribution={attributionKind(el)} field={field} />
              )}
            </div>
            <textarea
              value={el.content}
              onChange={(e) => editElement(el.id, e.target.value)}
              rows={2}
              placeholder={needs ? "Add this in your own words — BTY will not invent it." : ""}
              data-testid={`journey-edit-${el.kind}`}
              className="resize-none rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/85"
            />
          </div>
        );
      })}
    </section>
  );
}
