"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import {
  mapAnswersToJourney,
  isJourneyApprovable,
  sameJourney,
  type RealityGroundedJourneyV1,
  type JourneyElementKind,
} from "@/domain/foundry/module/journey";
import { attributionKind } from "@/domain/foundry/module/program-authorship";
import { EDITABLE_CHIP, EDITABLE_FIELD } from "./reviewSurfaceStyles";

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
  handoffSignal = 0,
}: {
  answers: BuilderAnswers;
  /** Persist a partial answers update (merged + saved) — same seam the Builder uses. */
  onPatch: (partial: BuilderAnswers, immediate: boolean) => void;
  onApprovableChange: (approvable: boolean) => void;
  /**
   * ADOPTION LANDS HERE (Slice R4-R2E). A counter the parent increments when a BTY program
   * actually became part of the draft. Each increment brings this section into view, gives it a
   * brief emphasis and moves keyboard focus to it — the answer to "the draft is adopted, now
   * where do I change it?".
   *
   * A COUNTER, not a boolean: two adoptions in one sitting are two handoffs, and a boolean that
   * is already `true` announces nothing the second time.
   */
  handoffSignal?: number;
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

  /*
    THE DRAFT'S JOURNEY CAN CHANGE WHILE THIS IS OPEN (Slice R4-R2D).

    This component held a copy captured at mount and never looked again. It is rendered as a
    SIBLING of ProgramAuthorship, so adopting a program replaced the journey in the Builder's
    answers while the preview kept the pre-adoption one — and the next edit wrote that stale copy
    back over the adopted journey. Silently: no error, no refusal, nothing on screen to notice.
    Not a cosmetic loss either, because `realityGroundedJourneyV1` is frozen into the published
    snapshot and is where `journeyObservableStandard` reads the sentence an observer is later
    asked to attest they saw.

    TWO QUESTIONS, ASKED IN ORDER, AND THE ORDER IS THE WHOLE RULE.

    1. DID UPSTREAM MOVE? Compared by reference against the last value we looked at. The Builder
       owns `answers` and replaces the object whenever it writes, so an unchanged reference means
       nothing happened up there — and we must not touch local state on a render we caused
       ourselves. Without this, a parent that does not merge our patch back (a test harness, or
       any future caller) would see the Host's own typing reverted on the next render. That is
       the naive "sync props to state" bug, and it is worse than the one being fixed because it
       fires constantly.

    2. IS THE NEW UPSTREAM VALUE OURS? Compared by VALUE. Our own `onPatch` comes straight back
       through the parent's merge, so upstream moving is not by itself evidence of anyone else.
       If it equals what we hold, there is nothing to adopt and nothing may move.

    Otherwise someone else wrote it, and they are authoritative: this surface owns a working
    copy, never the draft. In practice that is `applyProgram` — adopting a program, or ROLLING
    BACK a refused one, where taking the older journey is exactly right (3.2R-R2.4: the Builder
    must never hold a journey the database does not have).

    NO SERVER ECHO EXISTS, and that is why this rule is enough rather than a version negotiation.
    Measured, not assumed: the autosave "NEVER applies the server response back onto local state"
    (`moduleAutosave.ts`), and `setAnswers` has exactly four call sites — the initial load, this
    patch seam, `applyProgram`'s adoption and `applyProgram`'s rollback. A stale response cannot
    reach here, so there is nothing to order against and no version field is invented for one.

    THE TITLE DRAFT FOLLOWS. It is uncommitted local text belonging to the journey being replaced;
    leaving it would let a later Confirm stamp the OLD title, grounded, onto the NEW journey.
  */
  const upstream = answers.realityGroundedJourneyV1;
  const seenUpstreamRef = useRef(upstream);
  useEffect(() => {
    if (upstream === seenUpstreamRef.current) return;
    seenUpstreamRef.current = upstream;
    if (!upstream) return;
    if (sameJourney(upstream, journey)) return;
    setJourney(upstream);
    setTitleDraft(upstream.displayTitle);
  }, [upstream, journey]);

  useEffect(() => {
    onApprovableChange(isJourneyApprovable(journey));
  }, [journey, onApprovableChange]);

  /*
    THE ADOPTION HANDOFF (Slice R4-R2E).

    Measured before this: adopting a BTY program showed a short green panel where the long review
    had been, and left the Host looking at a screen that had just changed shape underneath them.
    The adopted words were now in the editable preview below — with nothing saying so, and often
    off screen entirely. G4 is exactly that gap.

    Three things happen, and each is the smallest version of itself:

      SCROLL, only when the section is not already comfortably in view, because scrolling a Host
      who is already looking at the destination is disorientation, not orientation. Smooth unless
      the platform says reduced motion, in which case it jumps.

      EMPHASIS, a ring for a few seconds. A ring, not an animation: the purpose is to say "here",
      and a moving thing says "look at me" over and over.

      FOCUS, onto the SECTION, not into a text box. Focusing a textarea would raise the iOS
      keyboard over the very content the Host was just brought to see, and would drop them into
      the middle of a form with no idea what is above. The section is `tabIndex={-1}`, so it takes
      programmatic focus, is announced with its heading, and the next Tab continues into the first
      field — reachable, never trapped.

    Guarded on `> 0` so a fresh mount at 0 announces nothing, and this component is mounted by the
    adoption itself in the common case (a draft becomes Journey-enabled when the program lands).
  */
  const sectionRef = useRef<HTMLElement | null>(null);
  const [handoffLit, setHandoffLit] = useState(false);
  useEffect(() => {
    if (handoffSignal <= 0) return;
    const el = sectionRef.current;
    setHandoffLit(true);
    if (el) {
      const box = el.getBoundingClientRect?.();
      const viewH = typeof window !== "undefined" ? window.innerHeight : 0;
      // "Reasonably visible" = its top edge is on screen and not jammed against the bottom.
      const alreadyVisible = !!box && viewH > 0 && box.top >= 0 && box.top < viewH * 0.6;
      if (!alreadyVisible) {
        const reduced =
          typeof window !== "undefined" && typeof window.matchMedia === "function"
            ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
            : false;
        el.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }
      el.focus?.({ preventScroll: true });
    }
    const timer = setTimeout(() => setHandoffLit(false), 4000);
    return () => clearTimeout(timer);
  }, [handoffSignal]);

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
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-labelledby="journey-preview-heading"
      data-testid="journey-preview"
      data-handoff={handoffLit ? "lit" : undefined}
      className={`flex flex-col gap-5 rounded-2xl p-1 outline-none transition-shadow duration-500 ${
        handoffLit ? "ring-2 ring-[#C9A66B]/70" : "ring-0"
      }`}
    >
      <div className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span id="journey-preview-heading" className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">Learner preview</span>
          {/* The one cue that answers "what can I change?" before any field is read (R4-R2E). */}
          <span className={EDITABLE_CHIP} data-testid="journey-editable-chip" aria-hidden>Yours to edit</span>
        </span>
        <p className="text-sm leading-6 text-white/55">This is exactly what your team will experience. Every gold box below is text you can rewrite.</p>
        {handoffLit ? (
          <p className="text-sm leading-6 text-[#C9A66B]" data-testid="journey-handoff-note" role="status">
            BTY’s draft is now here. Change any line below to make it yours.
          </p>
        ) : null}
      </div>

      {/* Participant title — must be Host-approved (never silently the raw problem line). */}
      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" data-testid="journey-title">
        {/* Chip beside the label, never inside it — see the same note in ProgramAuthorship. */}
        <div className="flex items-center gap-2">
          <label htmlFor="journey-title-input" className="text-xs uppercase tracking-[0.12em] text-white/40">
            Learner title
          </label>
          <span className={EDITABLE_CHIP} aria-hidden>Editable</span>
        </div>
        <input
          id="journey-title-input"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          data-testid="journey-title-input"
          data-surface="editable"
          className={`${EDITABLE_FIELD} text-base`}
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
              aria-label={`${KIND_LABEL[el.kind]} — the learner reads this`}
              data-testid={`journey-edit-${el.kind}`}
              data-surface="editable"
              className={`resize-none ${EDITABLE_FIELD} text-sm leading-6`}
            />
          </div>
        );
      })}
    </section>
  );
}
