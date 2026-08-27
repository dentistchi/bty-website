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
import { attributionKind, groundingAfterPreviewEdit } from "@/domain/foundry/module/program-authorship";
import { EDITABLE_FIELD } from "./reviewSurfaceStyles";
import { MODULE_BUILDER_COPY, type ModuleBuilderCopy } from "./moduleBuilderCopy";

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

/*
  THE SECTION NAMES ARE THE HOST'S LANGUAGE NOW (Slice R4-R5C15). Both maps lived here in English
  and rendered untranslated inside a Korean Builder, so a Korean Manager read Korean sentences
  under English headings — which is also how two adjacent sections came to look like one block.
  They moved to the Builder's own copy contract, where every other Host string already lives.
*/

/**
 * Honest authorship attribution. Saying "From your: …" over a sentence BTY authored is
 * the specific dishonesty Slice 3.2L closes, so the label is driven by the element's
 * recorded provenance, never assumed.
 */
function ProvenanceLabel({
  kind,
  attribution,
  field,
  t,
}: {
  kind: JourneyElementKind;
  attribution: ReturnType<typeof attributionKind>;
  field: string | undefined;
  t: ModuleBuilderCopy;
}) {
  const text =
    attribution === "bty_authored"
      ? t.jpDraftedByBty
      : attribution === "host_edited"
        ? t.jpYourEdit
        : attribution === "derived"
          ? t.jpFromSetup
          : t.jpFromYour(field ? (t.journeyField[field] ?? field) : "입력");
  return (
    /*
      QUIETER BY POSITION, NOT BY FADING (Slice R4-R2E-R3). Measured in real pixels before this
      change: 3.14:1 — already under WCAG AA. "Make provenance quieter" by lowering its colour
      would have pushed a sub-AA element further down, so the recession is achieved by moving it
      OUT of the header row (where it competed with the section name) to a footnote under the
      field, and the colour is RAISED to clear AA. Dominance is relative: the learner's text gets
      bigger and brighter, the metadata stops competing for the same line.
    */
    <span className="text-[0.66rem] leading-4 text-white/55" data-testid={`journey-grounded-${kind}`} data-provenance={attribution ?? "unknown"}>
      {text}
    </span>
  );
}

export function JourneyPreview({
  answers,
  onPatch,
  onApprovableChange,
  locale,
  handoffSignal = 0,
}: {
  answers: BuilderAnswers;
  /** Persist a partial answers update (merged + saved) — same seam the Builder uses. */
  onPatch: (partial: BuilderAnswers, immediate: boolean) => void;
  onApprovableChange: (approvable: boolean) => void;
  /** The Builder's locale — the Host reads these labels, so they are written in it (R4-R5C15). */
  locale: "en" | "ko";
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
    /*
      Slice R4-R8B — the seed now carries BTY's own completion question when the Host never
      authored one, so it has to be seeded in the Host's language. Passing the locale is what
      makes a Korean Builder seed a Korean sentence rather than an English one.
    */
    () => answers.realityGroundedJourneyV1 ?? mapAnswersToJourney(answers, locale),
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

  const t = MODULE_BUILDER_COPY[locale];

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
        elements: journey.elements.map((e) => {
          if (e.id !== id) return e;
          const filled = content.trim().length > 0;
          return {
            ...e,
            content,
            confirmationStatus: filled ? "grounded" : "needs_confirmation",
            /*
              WHOSE SENTENCE IS THIS NOW — ASKED, NOT DECIDED HERE (Slice R4-R5C18A).

              This used to stamp `host_statement` on every edit and reach for the `problem` field
              whenever the prior grounding was missing. Both were wrong, and the second only
              surfaced through the first: `onChange` fires per keystroke, so clearing the box
              persisted `grounding: []`, and the next character read `undefined?.field ?? "problem"`.
              A completed training carries the result — BTY's completion question, published as the
              Host's problem statement, and treated as the Host's own by the KEEP/USE default the
              next adoption opens on.

              `groundingAfterPreviewEdit` is the domain's answer, the same one adoption's edit
              branch uses. And CLEARING NO LONGER ERASES: an empty box is unsettled, not
              unattributed, so the identity the next keystroke needs is still there. The label stays
              hidden while `needs_confirmation`, so nothing claims authorship of an empty section.
            */
            grounding: filled ? groundingAfterPreviewEdit(e, e.kind) : e.grounding,
          };
        }),
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
        {/*
          ONE EDIT EXPLANATION (Slice R4-R2E-R3). This carried an eyebrow, a "Yours to edit" chip,
          a sentence, and an "Editable" chip on the title — four ways of saying the same thing
          above a field whose gold treatment already says it. The sentence is kept because it is
          the one that explains; every chip is gone. Measured first: all four chips were
          `aria-hidden`, so nothing left the accessible tree — the names come from `htmlFor` and
          `aria-label`, which are untouched.
        */}
        <span id="journey-preview-heading" className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">{t.jpEyebrow}</span>
        <p className="text-sm leading-6 text-white/55">{t.jpBody}</p>
        {handoffLit ? (
          <p className="text-sm leading-6 text-[#C9A66B]" data-testid="journey-handoff-note" role="status">
            {t.jpHandoffNote}
          </p>
        ) : null}
      </div>

      {/* Participant title — must be Host-approved (never silently the raw problem line). */}
      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" data-testid="journey-title">
        {/* Chip beside the label, never inside it — see the same note in ProgramAuthorship. */}
        <label htmlFor="journey-title-input" className="text-xs uppercase tracking-[0.12em] text-white/40">
          {t.jpTitleLabel}
        </label>
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
            {t.jpTitleConfirm}
          </button>
        ) : (
          <span className="text-xs text-emerald-300/80" data-testid="journey-title-ok">{t.jpTitleOk}</span>
        )}
      </div>

      {journey.elements.map((el) => {
        const needs = el.confirmationStatus === "needs_confirmation";
        const field = el.grounding[0]?.field;
        return (
          <div key={el.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" data-testid={`journey-preview-el-${el.kind}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C9A66B]/85">{t.journeyKind[el.kind]}</span>
              {/* "Needs confirmation" STAYS in the header: it is a thing to do, not metadata. */}
              {needs ? (
                <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-amber-200/90" data-testid={`journey-needs-${el.kind}`}>
                  {t.jpNeedsConfirmation}
                </span>
              ) : null}
            </div>
            <textarea
              value={el.content}
              onChange={(e) => editElement(el.id, e.target.value)}
              rows={2}
              placeholder={needs ? t.jpPlaceholder : ""}
              aria-label={`${t.journeyKind[el.kind]} — the learner reads this`}
              data-testid={`journey-edit-${el.kind}`}
              data-surface="editable"
              className={`resize-none ${EDITABLE_FIELD} text-[0.95rem] leading-6`}
            />
            {/* The footnote position: present, readable, and no longer competing with the name. */}
            {needs ? null : <ProvenanceLabel kind={el.kind} attribution={attributionKind(el)} field={field} t={t} />}
          </div>
        );
      })}
    </section>
  );
}
