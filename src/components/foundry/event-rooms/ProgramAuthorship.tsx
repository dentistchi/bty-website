"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JourneyElementKind, RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";
import {
  applyProgramProposal,
  attributionKind,
  contractsFromProposal,
  deriveInstructionalContent,
  missingProgramKinds,
  validateEditedReview,
  type ProgramContracts,
  type ProgramProposal,
  type ReviewBlockReason,
  type SectionChoice,
  type SectionDecision,
} from "@/domain/foundry/module/program-authorship";
import { isMetaStandardText } from "@/domain/foundry/module/program-coherence";
import { draftIdentityStatement, type BuilderAnswers } from "@/domain/foundry/module/module-builder";
import { Modal } from "@/components/ui/Modal";
import { AutoTextarea } from "@/components/bty/ui/AutoTextarea";
import { resolveRefusalCopy, RECOVERY_NOTE, type RefusalCopy } from "./programRefusalCopy";
import { DETAIL_FIELDS, REVIEW_BLOCK_COPY } from "./programReviewFields";

/**
 * Guided Program Authorship — the one place BTY says "here is the training I drafted for
 * you" (Slice 3.2L).
 *
 * ONE action produces ONE whole participant-shaped program. The Host then reviews it
 * section by section: keep what they wrote, use what BTY proposed, or rewrite it. Nothing
 * is applied until they say so, and applying writes the WHOLE journey in a single save —
 * there is deliberately no per-section apply, so a failed request can never leave half a
 * program behind.
 */

export const KIND_LABEL: Record<JourneyElementKind, string> = {
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

/**
 * Every Host-facing refusal sentence now lives in `programRefusalCopy`, keyed by the code
 * union itself, so a new refusal code without copy fails to compile. The tables that used
 * to live here covered the structural codes and two grounding codes and let ten semantic
 * codes fall through to a sentence about honesty — which is what the Founder was shown for
 * a relevance fault in the R4 window.
 */
export type ProgramGenerateOutcome =
  | { ok: true; proposal: ProgramProposal; evidenceCeiling: string; attemptId: string | null }
  | { ok: false; code: string; refusal?: string | null };

export function ProgramAuthorship({
  draftId,
  answers,
  journey,
  ready,
  onGenerate,
  onApply,
  onPendingChange,
}: {
  /** The exact loaded draft this surface is bound to. */
  draftId: string;
  answers: BuilderAnswers;
  journey: RealityGroundedJourneyV1 | undefined;
  ready: boolean;
  onGenerate: () => Promise<ProgramGenerateOutcome>;
  /** Persist the whole approved journey in ONE save. */
  onApply: (next: RealityGroundedJourneyV1, attemptId: string | null) => void;
  /**
   * Raised while a program draft is in flight. The Builder uses it to disable
   * publication — a generation and a publication must never overlap on one draft.
   */
  onPendingChange?: (pending: boolean) => void;
}) {
  // `confirm` sits between the button and the provider. Two controlled windows were
  // spent generating against the wrong training, so the PAID action gets its own target
  // boundary rather than relying on orientation alone (Slice 3.2L-R1.3).
  const [phase, setPhase] = useState<"idle" | "confirm" | "working" | "review" | "failed" | "applied">("idle");
  /** The target captured when the confirmation OPENED — never re-derived while it is open. */
  const [target, setTarget] = useState<{ draftId: string; focus: string | null } | null>(null);
  const generateButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  /** One gesture, one submission intent — rapid taps cannot open a second generation. */
  const submittingRef = useRef(false);
  const [proposal, setProposal] = useState<ProgramProposal | null>(null);
  const [ceiling, setCeiling] = useState("");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [failure, setFailure] = useState<RefusalCopy | null>(null);
  /** The stable refusal code behind `failure`, used only to choose the recovery action. */
  const [failureCode, setFailureCode] = useState<string>("");
  const [decisions, setDecisions] = useState<Record<string, SectionDecision>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  /** The shared authority every instructional sentence is rendered from. */
  const [contracts, setContracts] = useState<ProgramContracts | null>(null);
  /** The contracts BTY proposed, so Reset can restore them exactly. */
  const [baseContracts, setBaseContracts] = useState<ProgramContracts | null>(null);
  /**
   * NO `adjusted` STATE ANY MORE (Slice 3.2L-R8.1). Provenance used to be a manual map from
   * each control to the sections it was BELIEVED to affect, and it was wrong in both
   * directions on the physical gate: editing the confirmer visibly changed APPLY IT and
   * left it saying "Drafted by BTY", while BEFORE YOU FINISH and WHAT HAPPENS NEXT claimed
   * "Adjusted by you" with byte-identical sentences. A hand-maintained dependency list can
   * only ever approximate what the renderer does — so provenance is now COMPUTED from the
   * rendered output itself, below.
   */
  const [openDetails, setOpenDetails] = useState<string | null>(null);
  const [titleDecision, setTitleDecision] = useState<SectionDecision>("use");
  const [titleEdit, setTitleEdit] = useState("");

  const missing = useMemo(() => missingProgramKinds(answers, journey), [answers, journey]);

  // Opening the confirmation binds the target to THIS draft's loaded payload and calls
  // nothing. Zero parents, zero provider calls, zero draft writes.
  const openConfirmation = useCallback(() => {
    setTarget({ draftId, focus: draftIdentityStatement(answers) });
    setFailure(null);
    setFailureCode("");
    setPhase("confirm");
  }, [draftId, answers]);

  const cancelConfirmation = useCallback(() => {
    setTarget(null);
    setPhase("idle");
    // Focus returns to the control that opened it.
    requestAnimationFrame(() => generateButtonRef.current?.focus());
  }, []);

  const generate = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPhase("working");
    setFailure(null);
    onPendingChange?.(true);
    const r = await onGenerate();
    // The lease is released the moment the attempt reaches a terminal state, whichever
    // way it went — a failed generation must never leave publication wedged.
    onPendingChange?.(false);
    if (!r.ok) {
      // Exhaustively typed: a code with no copy is a compile error, not a fallback to
      // "didn't meet our honesty rules".
      setFailure(resolveRefusalCopy(r.code, r.refusal));
      setFailureCode(r.refusal ?? r.code);
      setPhase("failed");
      return;
    }
    setProposal(r.proposal);
    setCeiling(r.evidenceCeiling);
    setAttemptId(r.attemptId);
    // Default every section to the proposal — the Host asked BTY to draft it — but each
    // one is still an explicit, changeable choice.
    setDecisions(Object.fromEntries(r.proposal.elements.map((e) => [e.kind, "use" as SectionDecision])));
    setEdits(Object.fromEntries(r.proposal.elements.map((e) => [e.kind, e.content])));
    const c = contractsFromProposal(r.proposal, answers.followUpDays ?? 0);
    setContracts(c);
    setBaseContracts(c);
    setOpenDetails(null);
    setTitleDecision("use");
    setTitleEdit(r.proposal.displayTitle);
    setPhase("review");
  }, [onGenerate]);

  // Released only once the attempt reached a terminal state, so a completed or failed
  // generation can be started again — but never twice from one gesture.
  useEffect(() => {
    if (phase === "review" || phase === "failed" || phase === "applied") submittingRef.current = false;
  }, [phase]);

  // The confirmation takes focus when it opens.
  useEffect(() => {
    if (phase === "confirm") requestAnimationFrame(() => confirmButtonRef.current?.focus());
  }, [phase]);

  /**
   * EDITED-CONTENT AUTHORITY (Slice 3.2L-R4).
   *
   * THE STANDARD the Host reads is rendered from the validated `behaviorContract`. The
   * moment they rewrite it, that contract describes the PRE-EDIT text — so it is treated
   * as invalidated rather than carried along, and the edited words are re-checked on their
   * own terms.
   *
   * There is no stale-metadata Apply path to close: `applyProgramProposal` reads
   * participant-facing content and nothing else, and no persistence path stores a
   * `ProgramProposal`. What remains is the honest half — an edited standard that no longer
   * describes a behavior must not be applied silently just because BTY's original did.
   */
  /**
   * STRUCTURED REVIEW AUTHORITY (Slice 3.2L-R6.1).
   *
   * R6 derived six instructional sections from shared contracts but still offered six free
   * textareas, so a Host could edit APPLY IT to describe a different behaviour than THE
   * STANDARD and apply both. Nothing was persisted, so this was never a stale-database
   * defect — it was a product one.
   *
   * The Host now adjusts the CONTRACT, and every dependent sentence re-renders. A program
   * cannot disagree with itself, because there is only ever one behavioural authority to
   * disagree with. Narrative sections stay direct free-text edits: they instruct nobody.
   */
  const derivedContent = useCallback(
    (kind: JourneyElementKind): string | null => (contracts ? deriveInstructionalContent(kind, contracts) : null),
    [contracts],
  );

  /**
   * VISIBLE-OUTPUT PROVENANCE (Slice 3.2L-R8.1).
   *
   * A section is "Adjusted by you" when the sentence ON SCREEN differs from the sentence
   * BTY rendered — nothing else. Both sides go through the SAME `deriveInstructionalContent`,
   * one over the current contracts and one over the contracts the proposal arrived with, so
   * the badge cannot disagree with the text next to it however the renderer changes.
   *
   * That also settles the honest edge case the old list got backwards: changing a contract
   * value whose section does not render it leaves the sentence byte-identical, and a
   * byte-identical sentence is still BTY's draft.
   */
  const sectionAdjusted = useCallback(
    (kind: JourneyElementKind): boolean => {
      if (!contracts || !baseContracts) return false;
      const now = deriveInstructionalContent(kind, contracts);
      // Narrative sections carry no derivation; their provenance is the edit decision.
      if (now === null) return false;
      return now !== deriveInstructionalContent(kind, baseContracts);
    },
    [contracts, baseContracts],
  );

  /** The text that will actually be applied for one section. */
  const sectionText = useCallback(
    (kind: JourneyElementKind, fallback: string): string => derivedContent(kind) ?? edits[kind] ?? fallback,
    [derivedContent, edits],
  );

  /** Guard: a proposal from before v4 carries no contracts, so nothing is derived. */
  const hasContracts = contracts !== null;

  const reviewBlock = useMemo(() => {
    if (!contracts || !proposal) return null;
    const r = validateEditedReview(contracts, proposal.elements.map((e) => e.kind), edits, answers);
    return r.ok ? null : r;
  }, [contracts, proposal, edits, answers]);

  const apply = useCallback(() => {
    if (!proposal || reviewBlock) return;
    const choices: SectionChoice[] = proposal.elements.map((e) => {
      // Provenance follows what the HOST actually touched. A derived section they never
      // adjusted is still BTY's work, even though Apply re-reads its rendered text.
      const touched = sectionAdjusted(e.kind) || decisions[e.kind] === "edit";
      return {
        kind: e.kind,
        decision: touched ? "edit" : "use",
        // Apply always takes the CURRENTLY RENDERED sentence, never a stale one.
        editedContent: sectionText(e.kind, e.content),
      };
    });
    onApply(
      applyProgramProposal(journey, proposal, choices, { titleDecision, editedTitle: titleEdit }),
      attemptId,
    );
    setPhase("applied");
  }, [proposal, journey, titleDecision, titleEdit, attemptId, onApply, reviewBlock, sectionText, sectionAdjusted, decisions]);

  // ---- entry -------------------------------------------------------------
  const entrySurface = (
      <section className="flex flex-col gap-3 rounded-xl border border-[#C9A66B]/30 bg-[#C9A66B]/[0.05] px-4 py-4" data-testid="program-authorship-entry">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-[#C9A66B]">Let BTY draft this training for you</h3>
          <p className="text-sm leading-6 text-white/60">
            From what you’ve described, BTY will write the whole program your team will experience — why it matters,
            the standard, a situation to practise, the decision, and what happens afterwards. You review every
            section before anything is applied.
          </p>
        </div>
        {missing.length > 0 ? (
          <p className="text-xs leading-5 text-white/45" data-testid="program-missing-hint">
            Still needed for a complete program: {missing.map((k) => KIND_LABEL[k]).join(", ")}
          </p>
        ) : null}
        {failure ? (
          <div className="flex flex-col gap-1" data-testid="program-failure">
            <p className="text-sm leading-6 text-amber-200/90">{failure.headline}</p>
            {failure.explanation ? (
              <p className="text-sm leading-6 text-white/55">{failure.explanation}</p>
            ) : null}
          </div>
        ) : null}
        {/*
          RETRY AUTHORITY (Slice 3.2L-R5). No terminal failure offers a button that starts a
          generation. Drafting again is still possible and always goes back through the
          Training Program Target confirmation, which states that another draft starts a new
          AI generation. The R4 window offered "Draft it again" for a semantic refusal the
          Host could neither see nor correct — with the inputs unchanged, that is paying for
          a re-roll, presented as a remedy.
        */}
        {failure ? (
          <p className="text-xs leading-5 text-white/45" data-testid="program-no-retry-note">
            {RECOVERY_NOTE[failure.recovery]}
          </p>
        ) : (
          <button
            type="button"
            ref={generateButtonRef}
            onClick={openConfirmation}
            disabled={!ready}
            data-testid="program-generate"
            className="self-start rounded-xl bg-[#C9A66B] px-5 py-2.5 text-sm font-semibold text-[#0B1F3A] disabled:opacity-50"
          >
            Draft my training program
          </button>
        )}
        {!ready ? (
          <p className="text-xs text-white/40">Add the problem, who it’s for, the behaviour and the evidence first.</p>
        ) : null}
      </section>
  );

  if (phase === "idle" || phase === "failed") return entrySurface;

  // ---- target confirmation ------------------------------------------------
  if (phase === "confirm" && target) {
    return (
      <>
        {entrySurface}
        <Modal
          open
          onClose={cancelConfirmation}
          ariaLabel="Training program target"
          panelDataTestId="program-target-confirm"
          /* The shared Modal panel is `bg-foundry-white` (#FFFFFF). The Builder is a dark
             surface, so this content is written in white — which rendered WHITE ON WHITE on
             the physical iPhone: the Founder saw a blank panel with only the gold button,
             whose own colours made it the single visible element. `cn` is tailwind-merge, so
             overriding the panel here wins cleanly and changes no other Modal consumer.
             Also bounded in height with internal scroll, so a long focus can never push the
             actions off-screen. */
          className="max-h-[85dvh] overflow-y-auto overscroll-contain border-white/12 bg-[#0B1F3A] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 border-l-2 border-[#C9A66B]/50 pl-3">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#C9A66B]/90">
                Training program target
              </span>
              {/* The dominant content: what BTY is about to spend a generation on. Bound at
                  open time to THIS draft's loaded payload, wrapping fully so a long focus
                  keeps its distinguishing tail. */}
              <p
                data-testid={target.focus ? "program-target-focus" : "program-target-fallback"}
                data-target-draft-id={target.draftId}
                className={`break-words text-lg font-semibold leading-7 ${target.focus ? "text-white" : "text-white/50"}`}
              >
                {target.focus ?? "Untitled training draft"}
              </p>
            </div>

            <p className="text-sm leading-6 text-white/70">
              BTY will draft a program for this training focus. Nothing will be added or published until you review
              and apply it.
            </p>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                ref={confirmButtonRef}
                onClick={() => void generate()}
                disabled={submittingRef.current}
                data-testid="program-target-confirm-action"
                className="min-h-[44px] w-full rounded-xl bg-[#C9A66B] px-5 py-3 text-sm font-semibold text-[#0B1F3A] disabled:opacity-60"
              >
                Draft program for this training
              </button>
              <button
                type="button"
                onClick={cancelConfirmation}
                disabled={submittingRef.current}
                data-testid="program-target-cancel"
                className="min-h-[44px] w-full rounded-xl border border-white/25 px-5 py-3 text-sm font-medium text-white/80 disabled:opacity-40"
              >
                Go back
              </button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  if (phase === "working") {
    return (
      <section className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-5" data-testid="program-working">
        <p className="text-sm text-white/60">Writing your training program…</p>
        <p className="mt-1 text-xs text-white/40">Nothing in your draft changes until you apply it.</p>
      </section>
    );
  }

  if (phase === "applied") {
    return (
      <section className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-4" data-testid="program-applied">
        <p className="text-sm font-medium text-emerald-200/90">Added to your training — every section is still editable below.</p>
      </section>
    );
  }

  // ---- section-by-section review ----------------------------------------
  const p = proposal!;
  return (
    <section className="flex flex-col gap-4" data-testid="program-review">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">BTY drafted this for you</span>
        <p className="text-sm leading-6 text-white/55">
          Nothing is approved or published yet. Keep, use or rewrite each section — you decide what your team sees.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" data-testid="program-title">
        <span className="text-xs uppercase tracking-[0.12em] text-white/40">Program title</span>
        <input
          value={titleEdit}
          onChange={(e) => {
            setTitleEdit(e.target.value);
            setTitleDecision("edit");
          }}
          data-testid="program-title-input"
          className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-base text-white/90"
        />
      </div>

      {p.elements.map((e) => {
        const derived = derivedContent(e.kind);
        const isDerived = derived !== null;
        const wasAdjusted = sectionAdjusted(e.kind);
        const open = openDetails === e.kind;
        return (
          <div key={e.kind} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" data-testid={`program-section-${e.kind}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C9A66B]/85">{KIND_LABEL[e.kind]}</span>
              {/*
                "Adjusted by you", not "Your rewrite": for a derived section the sentence is
                still deterministically rendered by BTY — from values the Host changed. Calling
                that the Host's rewrite would be as inaccurate as calling it BTY's own draft.
              */}
              <span className="rounded-md bg-[#C9A66B]/15 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#C9A66B]/90">
                {wasAdjusted || (!isDerived && decisions[e.kind] === "edit") ? "Adjusted by you" : "Drafted by BTY"}
              </span>
            </div>

            {isDerived ? (
              <>
                {/*
                  READ-ONLY derived text plus structured controls (pattern A). Six free
                  textareas let one section drift from another; adjusting the shared values
                  cannot, because every dependent sentence re-renders from them.
                */}
                <p className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/85" data-testid={`program-derived-${e.kind}`}>
                  {derived}
                </p>
                <button
                  type="button"
                  onClick={() => setOpenDetails(open ? null : e.kind)}
                  aria-expanded={open}
                  data-testid={`program-details-toggle-${e.kind}`}
                  className="self-start rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/[0.06]"
                >
                  {open ? "Done" : "Edit details"}
                </button>
                {open ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3" data-testid={`program-details-${e.kind}`}>
                    {DETAIL_FIELDS[e.kind]?.map((f) => (
                      <label key={f.id} className="flex flex-col gap-1">
                        <span className="text-xs text-white/45">{f.label}</span>
                        {f.options ? (
                          <select
                            value={f.get(contracts!) ?? ""}
                            onChange={(ev) => {
                              setContracts((c) => (c ? f.set(c, ev.target.value) : c));
                            }}
                            data-testid={`program-field-${f.id}`}
                            className="rounded-lg border border-white/15 bg-[#0B1F3A] px-3 py-2 text-sm text-white/85"
                          >
                            {f.options.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <AutoTextarea
                            value={f.get(contracts!) ?? ""}
                            onChange={(next) => {
                              setContracts((c) => (c ? f.set(c, next) : c));
                            }}
                            rows={2}
                            data-testid={`program-field-${f.id}`}
                            className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/85"
                          />
                        )}
                      </label>
                    ))}
                    {e.kind === "follow_up" ? (
                      <p className="text-xs leading-5 text-white/40">
                        The {contracts?.followUpDays ?? 0}-day window comes from your training setup and isn’t changed here.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              /* NARRATIVE — the Host owns these words directly; they instruct nobody. */
              <AutoTextarea
                value={edits[e.kind] ?? e.content}
                onChange={(next) => {
                  setEdits((s) => ({ ...s, [e.kind]: next }));
                  setDecisions((s) => ({ ...s, [e.kind]: "edit" }));
                }}
                rows={3}
                data-testid={`program-edit-${e.kind}`}
                className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/85"
              />
            )}
            <p className="text-xs leading-5 text-white/40">{e.rationale}</p>
          </div>
        );
      })}

      {/*
        ONE EVIDENCE CEILING (Slice 3.2L-R8.1). This block used to print BOTH the API's
        `evidence_ceiling` and the proposal's `evidenceLanguage` — two paragraphs, one after
        the other, saying overlapping things. They were never two authorities: both are
        `deriveEvidenceCeiling(answers)`, computed at different moments in the request. The
        proposal's copy is the one that was validated with the program, so it is the one
        shown; the API value survives only as a fallback for a pre-v6 proposal that carries
        no ceiling of its own.
      */}
      {p.evidenceLanguage || ceiling ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" data-testid="program-evidence-ceiling">
          <span className="text-xs uppercase tracking-[0.12em] text-white/40">What this can and cannot show</span>
          <p className="mt-1 text-sm leading-6 text-white/70" data-testid="program-evidence-text">
            {p.evidenceLanguage || ceiling}
          </p>
        </div>
      ) : null}

      {p.assumptions.length > 0 ? (
        <ListBlock title="This assumes" items={p.assumptions} testid="program-assumptions" />
      ) : null}
      {p.warnings.length > 0 ? (
        <ListBlock title="Worth noting" items={p.warnings} testid="program-warnings" tone="amber" />
      ) : null}

      {reviewBlock ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/[0.05] px-4 py-3 text-sm leading-6 text-amber-100/85" data-testid="program-review-block">
          {REVIEW_BLOCK_COPY[reviewBlock.reason]}
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={apply}
          disabled={reviewBlock !== null}
          data-testid="program-apply"
          className="rounded-xl bg-[#C9A66B] px-5 py-2.5 text-sm font-semibold text-[#0B1F3A] disabled:opacity-40"
        >
          Add this program to my training
        </button>
        <button
          type="button"
          onClick={() => {
            setContracts(baseContracts);
            setEdits(Object.fromEntries(p.elements.map((el) => [el.kind, el.content])));
            setDecisions(Object.fromEntries(p.elements.map((el) => [el.kind, "use" as SectionDecision])));
            setTitleEdit(p.displayTitle);
            setTitleDecision("use");
            setOpenDetails(null);
          }}
          data-testid="program-reset"
          className="text-sm text-white/55"
        >
          Reset to BTY’s draft
        </button>
        <button type="button" onClick={() => setPhase("idle")} data-testid="program-discard" className="text-sm text-white/55">
          Discard
        </button>
      </div>
      <p className="text-xs text-white/40">Applying adds it to your draft. It still isn’t approved, published, or visible to anyone.</p>
    </section>
  );
}

function ListBlock({ title, items, testid, tone }: { title: string; items: string[]; testid: string; tone?: "amber" }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone === "amber" ? "border-amber-400/25 bg-amber-400/[0.05]" : "border-white/10 bg-white/[0.02]"}`} data-testid={testid}>
      <span className={`text-xs uppercase tracking-[0.12em] ${tone === "amber" ? "text-amber-200/70" : "text-white/40"}`}>{title}</span>
      <ul className="mt-1 flex flex-col gap-1">
        {items.map((t, i) => (
          <li key={i} className={`text-sm leading-6 ${tone === "amber" ? "text-amber-100/85" : "text-white/65"}`}>• {t}</li>
        ))}
      </ul>
    </div>
  );
}

/** Re-exported so the Review surface labels provenance from ONE source. */
export { attributionKind };
