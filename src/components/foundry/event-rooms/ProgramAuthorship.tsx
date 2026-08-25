"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearCachedProposal, readCachedProposal, writeCachedProposal, type CachedProposal } from "./proposalContinuity";
import type { JourneyElementKind, RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";
import {
  applyProgramProposal,
  attributionKind,
  contractsFromProposal,
  deriveInstructionalContent,
  derivesFrom,
  isHostAuthoredKind,
  initialSectionDecisions,
  isPreservableHostSection,
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
import { resolveRefusalCopy, resolveAdoptionRefusalCopy, RECOVERY_NOTE, type RefusalCopy } from "./programRefusalCopy";
import { DETAIL_FIELDS, FIELD_GROUP_HEADING, REVIEW_BLOCK_COPY } from "./programReviewFields";
import { MODULE_BUILDER_COPY } from "./moduleBuilderCopy";
import { EDITABLE_FIELD, EDITABLE_FIELD_FRAME, READONLY_TEXT } from "./reviewSurfaceStyles";

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
/**
 * What the server established about an Apply (Slice 3.2L-R11.3B). The surface waits for
 * this before it says anything: "added" is a claim about durable state, and it may not be
 * made optimistically.
 */
export type ProgramApplyOutcome =
  /** Durable, and the ledger carries its receipt. */
  | { status: "adopted" }
  /** Durable — the receipt is still being written and completes on the next save. */
  | { status: "adopted_receipt_pending" }
  /** The server refused the claim. The Host's other changes still saved. */
  | { status: "refused" }
  /** The save itself did not land. Nothing was added. */
  | { status: "save_failed" };

export type ProgramGenerateOutcome =
  | {
      ok: true;
      proposal: ProgramProposal;
      evidenceCeiling: string;
      attemptId: string | null;
      /** The Host-input authority this proposal was written from (Slice 3.2L-R11). */
      contextFingerprint: string;
    }
  | { ok: false; code: string; refusal?: string | null };

export function ProgramAuthorship({
  sectionRef,
  draftId,
  locale,
  answers,
  journey,
  ready,
  notReadyReason,
  onGenerate,
  onCheckResume,
  onApply,
  currentContextFingerprint,
  adoptionRefusal,
  onDismissRefusal,
  onPendingChange,
  onAdopted,
}: {
  /**
   * R4-R7A-R2 — so Review's repair CTA can bring this surface into view on a phone. The
   * ref lives on THIS section, not on the two-column layout wrappers, which
   * `managerResponsiveLayout` pins as layout-only — a guard that caught the first attempt.
   */
  sectionRef?: React.Ref<HTMLElement>;
  /** The exact loaded draft this surface is bound to. */
  draftId: string;
  /**
   * The Builder's own locale (Slice R4-R5C13). BTY renders seven of the nine sections itself,
   * and before this the review surface derived them with no locale at all — so a Korean Host
   * read four fully English sections and adopting would have frozen them into the learner's
   * training. Host and model text is untouched by it.
   */
  locale: "en" | "ko";
  answers: BuilderAnswers;
  journey: RealityGroundedJourneyV1 | undefined;
  ready: boolean;
  /**
   * The NEXT thing the Host needs to provide, in the Builder's own words (Slice R4-R2F).
   *
   * Derived by the caller from the SAME computation that produced `ready`, so this can never
   * describe a different requirement than the one holding the button. Absent means the caller
   * could not name one, and the general sentence stands.
   */
  notReadyReason?: string;
  onGenerate: () => Promise<ProgramGenerateOutcome>;
  /**
   * May a browser-held proposal from this attempt still be offered? (Slice 3.2L-R11.4K-R1)
   * Server-owned and read-only; absent means the caller cannot check, and continuity then
   * fails CLOSED rather than showing a program that may already have been adopted.
   */
  onCheckResume?: (attemptId: string) => Promise<boolean>;
  /**
   * Persist the whole approved journey in ONE save.
   *
   * `reference` is the proposal this journey was built from (Slice R4-R2E-R1). It travels so the
   * SERVER can tell a preserved Host section from a substituted one — a distinction it cannot
   * otherwise make, because the proposal body is not stored anywhere. It is proved against the
   * attempt's durable digest before it is believed.
   */
  onApply: (
    next: RealityGroundedJourneyV1,
    attemptId: string | null,
    reference?: { displayTitle: string; elements: { kind: string; content: string }[] },
    /**
     * What the Host did with each section — `keep` | `use` | `edit` (Slice R4-R2E-R2). A
     * DECLARATION the server checks, not evidence it trusts: a `keep` that does not keep, or a
     * `use` that is not BTY's words, is refused. `edit` is the Founder's third legitimate
     * outcome and is accepted as the Host's own authorship, never as BTY's.
     */
    decisions?: Record<string, string>,
  ) => Promise<ProgramApplyOutcome> | void;
  /**
   * The Host-input authority as it is RIGHT NOW. Compared against the fingerprint the
   * proposal was written from, so a proposal cannot silently overwrite answers the Host
   * changed after generating it (Slice 3.2L-R11).
   */
  currentContextFingerprint: string;
  /**
   * The server refused the adoption claim. The draft still saved — but nothing was added,
   * and this surface must not say otherwise (Slice 3.2L-R11.3A).
   */
  adoptionRefusal?: string | null;
  /**
   * Clear the parent's refusal so the entry surface can be reached again (Slice R4-R5C14A-R3).
   * The refusal itself is the parent's state and is only reset when an adoption is ATTEMPTED —
   * which the Host cannot do, because the screen that adopts is the one the refusal replaced.
   */
  onDismissRefusal?: () => void;
  /**
   * Raised while a program draft is in flight. The Builder uses it to disable
   * publication — a generation and a publication must never overlap on one draft.
   */
  onPendingChange?: (pending: boolean) => void;
  /**
   * A program actually became part of the draft (Slice R4-R2E). Raised ONCE, from an effect,
   * so it fires AFTER this surface has collapsed to its confirmation panel — the parent uses
   * it to take the Host to where the adopted words can now be edited, and that destination
   * would otherwise be moved by the collapse the instant after it was brought into view.
   *
   * Never raised for a refusal or a save failure: nothing was added, so there is nowhere to go.
   */
  onAdopted?: () => void;
}) {
  // `confirm` sits between the button and the provider. Two controlled windows were
  // spent generating against the wrong training, so the PAID action gets its own target
  // boundary rather than relying on orientation alone (Slice 3.2L-R1.3).
  const [phase, setPhase] = useState<"idle" | "confirm" | "working" | "review" | "failed" | "applying" | "applied">("idle");
  /** What the server established. Never assumed — the panel waits for it. */
  const [applyOutcome, setApplyOutcome] = useState<ProgramApplyOutcome | null>(null);
  /** The target captured when the confirmation OPENED — never re-derived while it is open. */
  const [target, setTarget] = useState<{ draftId: string; focus: string | null } | null>(null);
  const generateButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  /** One gesture, one submission intent — rapid taps cannot open a second generation. */
  const submittingRef = useRef(false);
  const [proposal, setProposal] = useState<ProgramProposal | null>(null);
  const [ceiling, setCeiling] = useState("");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  /** The Host inputs this proposal was written from. Empty until one exists. */
  const [proposalFingerprint, setProposalFingerprint] = useState("");
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
  /**
   * Is the adopted BTY draft open for reference? (Slice R4-R2E-R3-R1)
   *
   * Closed by default: once the program is part of the training, the Learner Preview below is
   * the thing that matters, and this must not push it down the screen again.
   */
  const [adoptedDraftOpen, setAdoptedDraftOpen] = useState(false);
  /**
   * WHICH SECTION IS OPEN FOR EDITING (Slice R4-R2E-R4). One at a time, and none by default.
   *
   * Measured at 390x844 before this: the pre-adoption review was 2332px and "Add this program to
   * my training" sat at y=2240 — 2.7 screens of scrolling to reach the primary action, with the
   * six section bodies accounting for 1866px, 80% of it. The Host was made to read the whole
   * document to approve a draft they mostly agreed with.
   *
   * Nothing about the DECISIONS changes: the defaults R4-R2A-R1 computed are still authoritative
   * and still applied. Only the reading of them is folded away until asked for.
   */
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [titleEdit, setTitleEdit] = useState("");

  const missing = useMemo(() => missingProgramKinds(answers, journey), [answers, journey]);

  /** The journey as it stands, by kind — what a `keep` would preserve (Slice R4-R2A-R1). */
  const currentByKind = useMemo(
    () => new Map((journey?.elements ?? []).map((el) => [el.kind, el])),
    [journey],
  );

  // Opening the confirmation binds the target to THIS draft's loaded payload and calls
  // nothing. Zero parents, zero provider calls, zero draft writes.
  const openConfirmation = useCallback(() => {
    setTarget({ draftId, focus: draftIdentityStatement(answers) });
    setFailure(null);
    setFailureCode("");
    setPhase("confirm");
  }, [draftId, answers]);

  /**
   * BACK TO THE ENTRY SURFACE AFTER A REFUSED ADOPTION (Slice R4-R5C14A-R3).
   *
   * Everything the refused review held is dropped, including the continuity cache: that proposal
   * was written from inputs the draft no longer has, and keeping it would let a later mount offer
   * it again. `phase` returns to `idle`, which is the ONLY state that renders the generation
   * entry — the same one a Host reaches before their first draft, with the same confirmation
   * ahead of it. No provider call happens here.
   */
  const recoverFromRefusal = useCallback(() => {
    onDismissRefusal?.();
    clearCachedProposal(draftId);
    setApplyOutcome(null);
    setProposal(null);
    setAttemptId(null);
    setProposalFingerprint("");
    setContracts(null);
    setBaseContracts(null);
    setDecisions({});
    setEdits({});
    setAdoptedDraftOpen(false);
    setFailure(null);
    setFailureCode("");
    setPhase("idle");
    requestAnimationFrame(() => generateButtonRef.current?.focus());
  }, [draftId, onDismissRefusal]);

  const cancelConfirmation = useCallback(() => {
    setTarget(null);
    setPhase("idle");
    // Focus returns to the control that opened it.
    requestAnimationFrame(() => generateButtonRef.current?.focus());
  }, []);

  /**
   * ONE transition into review, used by a fresh generation and by a resumed one, so the two
   * can never render different things from the same proposal (Slice 3.2L-R11.4K).
   */
  const showProposal = useCallback(
    (entry: CachedProposal) => {
      setProposal(entry.proposal);
      setCeiling(entry.evidenceCeiling);
      setAttemptId(entry.attemptId);
      setProposalFingerprint(entry.contextFingerprint);
      /*
        Default a section to the proposal ONLY where the Host has not already settled it in
        their own words (Slice R4-R2A-R1). A grounded `host_statement` / `host_edited` element
        starts on `keep`, so BTY fills the gaps it was asked to fill and never silently
        overwrites a sentence the Host authored. Every section remains a changeable choice.
      */
      setDecisions(initialSectionDecisions(journey, entry.proposal));
      setEdits(Object.fromEntries(entry.proposal.elements.map((e) => [e.kind, e.content])));
      const c = contractsFromProposal(entry.proposal, answers.followUpDays ?? 0, answers.problem ?? "", answers.completionPrompt ?? null, answers, [], locale);
      setContracts(c);
      setBaseContracts(c);
      setOpenDetails(null);
      setTitleDecision("use");
      setTitleEdit(entry.proposal.displayTitle);
      setPhase("review");
    },
    // `journey` decides which sections open on `keep`, so the review must be built from the
    // journey as it stands when the proposal is shown (Slice R4-R2A-R1).
    [answers.followUpDays, answers.problem, journey, locale],
  );

  /**
   * RESUME. Reads only — no provider call, no attempt, no draft write. The fingerprint the
   * proposal was written from must still equal the draft's current one, so a Host who has
   * since changed their inputs is never shown a program written from the old ones.
   */
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || phase !== "idle" || !ready) return;
    if (!currentContextFingerprint) return;
    const cached = readCachedProposal(draftId, currentContextFingerprint);
    if (!cached) return;
    resumedRef.current = true;

    /*
      FAIL CLOSED (Slice 3.2L-R11.4K-R1). The fingerprint match proves the proposal still
      fits the draft's inputs. It cannot prove the attempt is still adoptable — it may have
      been applied in another tab, replaced by a newer generation, or stopped being owned.
      Only the server knows, so the words are not offered until it says so, and a cache it
      refuses is cleared rather than left to be re-offered on the next mount.
    */
    if (!cached.attemptId || !onCheckResume) {
      clearCachedProposal(draftId);
      return;
    }
    let live = true;
    void onCheckResume(cached.attemptId).then((eligible) => {
      if (!live) return;
      if (!eligible) {
        clearCachedProposal(draftId);
        return;
      }
      showProposal(cached);
    });
    return () => {
      live = false;
    };
  }, [draftId, currentContextFingerprint, phase, ready, showProposal, onCheckResume]);

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
    showProposal({
      attemptId: r.attemptId,
      contextFingerprint: r.contextFingerprint,
      proposal: r.proposal,
      evidenceCeiling: r.evidenceCeiling,
    });
    /*
      A successful generation is unfinished user work. It survives ordinary navigation and a
      reload from here on, in the Host's own session and nowhere else (Slice 3.2L-R11.4K).
    */
    writeCachedProposal(draftId, {
      attemptId: r.attemptId,
      contextFingerprint: r.contextFingerprint,
      proposal: r.proposal,
      evidenceCeiling: r.evidenceCeiling,
    });
  }, [onGenerate, showProposal, draftId]);

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
   * THE HANDOFF (Slice R4-R2E). Announced from an EFFECT, not from `apply`, and that ordering is
   * the whole point: by the time this runs, React has already committed the collapse of the long
   * review down to the short confirmation panel. Announcing it inside `apply` would hand the
   * parent a destination and then move it by several hundred pixels in the very next commit.
   *
   * Once only — `phase` stays "applied", and a second announcement would re-take focus from a
   * Host who had already started typing.
   */
  const adoptedAnnouncedRef = useRef(false);
  useEffect(() => {
    if (phase !== "applied" || adoptedAnnouncedRef.current) return;
    if (applyOutcome?.status !== "adopted" && applyOutcome?.status !== "adopted_receipt_pending") return;
    adoptedAnnouncedRef.current = true;
    onAdopted?.();
  }, [phase, applyOutcome, onAdopted]);

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
  const t = MODULE_BUILDER_COPY[locale];

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

  /**
   * STALE-AUTHORITY GATE (Slice 3.2L-R11).
   *
   * The server refuses a proposal whose draft moved WHILE the provider was working. It
   * cannot see what happens afterwards: the Host can change the problem, the behaviour or
   * the evidence in the Builder and then come back and press Add, and the journey written
   * from the older answers would silently become the program.
   *
   * Compared by CONTEXT FINGERPRINT, not by `updated_at` — navigating between steps
   * legitimately moves the timestamp and changes no authority, which is exactly what the
   * Founder did after the live window.
   */
  const proposalIsStale =
    proposalFingerprint.length > 0 &&
    currentContextFingerprint.length > 0 &&
    proposalFingerprint !== currentContextFingerprint;

  const apply = useCallback(async () => {
    if (!proposal || reviewBlock || proposalIsStale) return;
    const choices: SectionChoice[] = proposal.elements.map((e) => {
      /*
        KEEP OUTRANKS EVERYTHING (Slice R4-R2A-R1). A Host who chose to keep their own
        sentence is not asking for a rendered one, so a contract adjustment — which changes
        the DERIVED text this section would otherwise have shown — must not quietly promote
        the choice back to `edit` and overwrite them. Switching to "Use BTY draft" is the
        explicit way back, and it is one tap.
      */
      const chosen = decisions[e.kind];
      if (chosen === "keep") return { kind: e.kind, decision: "keep" };
      // Provenance follows what the HOST actually touched. A derived section they never
      // adjusted is still BTY's work, even though Apply re-reads its rendered text.
      const touched = sectionAdjusted(e.kind) || chosen === "edit";
      return {
        kind: e.kind,
        decision: touched ? "edit" : "use",
        // Apply always takes the CURRENTLY RENDERED sentence, never a stale one.
        editedContent: sectionText(e.kind, e.content),
      };
    });
    /*
      NO OPTIMISTIC "ADDED" (Slice 3.2L-R11.3B). The server decides whether this adoption
      is provable, and until it answers the honest state is "adding", not "added".
    */
    setPhase("applying");
    /*
      NOTHING IS ASSUMED AND NOTHING IS THROWN AWAY UNLESS IT WORKED (Slice 3.2R-R2.4).

      Three faults sat in these five lines, and together they are how a Host ends up believing a
      program was added when the database never received it:

        * `outcome ?? { status: "adopted" }` defaulted a MISSING answer to success, in the very
          function whose comment says "NO OPTIMISTIC 'ADDED'".
        * `clearCachedProposal` ran unconditionally, so a refused Apply destroyed the reviewed
          work the Host would need in order to retry — the continuity cache R11.4K exists to keep.
        * there was no `catch`, so a throw left the surface stuck on "applying" forever with no
          error and no way back.

      Now: a missing outcome is a failure, the cache survives anything but a real adoption, and a
      thrown error becomes a visible, retryable state.
    */
    let outcome: ProgramApplyOutcome;
    try {
      outcome =
        (await onApply(
          applyProgramProposal(journey, proposal, choices, { titleDecision, editedTitle: titleEdit }),
          attemptId,
          /*
            The proposal EXACTLY as it was generated — never the edited or kept text, and never a
            digest (Slice R4-R2E-R1). The server hashes this and compares it with the attempt's
            durable digest, so sending anything other than the untouched proposal simply fails
            the check and falls back to the strict rule.
          */
          { displayTitle: proposal.displayTitle, elements: proposal.elements.map((e) => ({ kind: e.kind, content: e.content })) },
          // The same `choices` the journey was built from — one source, so the declaration and
          // the content can never describe different decisions.
          Object.fromEntries(choices.map((c) => [c.kind, c.decision])),
        )) ?? { status: "save_failed" };
    } catch {
      outcome = { status: "save_failed" };
    }
    setApplyOutcome(outcome);
    // Only a real adoption finishes the work. Anything else keeps it resumable.
    if (outcome.status === "adopted" || outcome.status === "adopted_receipt_pending") {
      clearCachedProposal(draftId);
    }
    setPhase("applied");
  }, [proposal, journey, titleDecision, titleEdit, attemptId, onApply, reviewBlock, proposalIsStale, sectionText, sectionAdjusted, decisions, draftId]);

  // ---- entry -------------------------------------------------------------
  const entrySurface = (
      <section ref={sectionRef} className="flex flex-col gap-3 rounded-xl border border-[#C9A66B]/30 bg-[#C9A66B]/[0.05] px-4 py-4" data-testid="program-authorship-entry">
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
        {/*
          THE NEXT THING, NOT A CHECKLIST (Slice R4-R2F). This used to name four requirements from
          memory while the predicate checked five — the recurring moment was missing from the
          sentence, which is the one most production drafts actually lack.
        */}
        {!ready ? (
          <p className="text-xs text-white/40" data-testid="program-not-ready-reason">
            {notReadyReason ?? "Add the problem, who it’s for, the behaviour and the evidence first."}
          </p>
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

  if (phase === "applying") {
    return (
      <section className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-5" data-testid="program-applying">
        <p className="text-sm text-white/60">Adding this program to your training…</p>
      </section>
    );
  }

  if (phase === "applied") {
    if (applyOutcome?.status === "save_failed") {
      return (
        <section className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-3.5 py-2.5" data-testid="program-apply-save-failed">
          <p className="text-sm font-medium text-amber-100/90">This program wasn’t added.</p>
          <p className="mt-0.5 text-sm leading-5 text-amber-100/75">
            Nothing was saved, and your draft is unchanged. Your review is still here — try adding it again.
          </p>
        </section>
      );
    }
    if (applyOutcome?.status === "adopted_receipt_pending") {
      return (
        <section className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-3.5 py-2.5" data-testid="program-applied-pending">
          <p className="text-sm font-medium text-emerald-200/90">Added to your training. Finishing the record…</p>
        </section>
      );
    }
    if (applyOutcome?.status === "refused" || adoptionRefusal) {
      /*
        ONE SENTENCE PER REASON (Slice R4-R2E-R1). This used to be a two-way ternary over eight
        closed reasons, so `proposal_mismatch` was reported as "Your training moved on since BTY
        wrote this draft" — measured false on production draft `d04d48e1`, whose fingerprint was
        byte-identical. An unrecognised reason gets the honest fallback rather than a guess.
      */
      const copy = resolveAdoptionRefusalCopy(adoptionRefusal ?? null);
      return (
        /*
          COMPACT, NEVER QUIET (Slice R4-R2E-R3). A failure keeps BOTH sentences and its amber
          frame — the height came down, the warning did not. Only the success panel loses a line,
          because that line duplicated the handoff note the Learner Preview raises anyway.
        */
        <section className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-3.5 py-2.5" data-testid="program-apply-refused">
          <p className="text-sm font-medium text-amber-100/90" data-testid="program-refused-headline">
            {copy.headline} Your other changes were saved.
          </p>
          <p className="mt-0.5 text-sm leading-5 text-amber-100/75" data-testid="program-refused-explanation">
            {copy.explanation}
          </p>
          {/*
            THE WAY OUT (Slice R4-R5C14A-R3).

            FOUNDER-OBSERVED on a real Korean training. The refusal was CORRECT — the draft had
            moved since the proposal was written, and the attempt behind it was already spent —
            and the Host's edits were safely saved. But `apply()` sets `phase` to "applied"
            whatever the outcome, and "Draft my training program" lives only in `idle`/`failed`,
            so a correct refusal replaced the only screen that could recover from it. Zero
            actions, measured. The Host was told what went wrong and given nothing to do about
            it until they closed and reopened the app.

            One action, and it starts nothing on its own: it returns to the entry surface, where
            drafting again still goes through the Training Program Target confirmation exactly as
            a first draft does. Nothing about the refusal itself is relaxed — the stale proposal
            is discarded here rather than reused, so it cannot be adopted by another route.
          */}
          <p className="mt-2 text-sm leading-5 text-amber-100/85" data-testid="program-refused-recovery">
            {t.programRefusedRecovery}
          </p>
          <button
            type="button"
            onClick={recoverFromRefusal}
            data-testid="program-refused-retry"
            /* 44px, because this is the control the Host is stuck without and it is tapped with
               a thumb — the same target size the rest of this Builder uses. */
            className="mt-1.5 self-start rounded-lg px-3 py-2.5 text-sm font-semibold text-amber-100 underline underline-offset-4 transition-colors hover:text-amber-50"
          >
            {t.programRefusedRecoveryCta} →
          </button>
        </section>
      );
    }
    return (
      /*
        THE COMPACT ROW, AND THE WAY BACK (Slice R4-R2E-R3-R1).

        MEASURED FIRST, at 390x844: the long program review is 1859px tall and Learner Preview
        starts at y=1875 — but only BEFORE adoption. A successful adoption already replaced all of
        it with this 42px panel, putting Learner Preview at y=58. The collapse the brief asked for
        was already the behaviour.

        What the measurement DID expose is the other half: the BTY draft became unreachable. There
        was no way back to what BTY had written, which is exactly the Founder's G2. So this row
        gains a disclosure — closed by default, so the compact screen stays compact.

        DELIBERATELY READ-ONLY. The program is adopted; this is for reading what BTY wrote, not
        for adopting it again. No Apply, no Reset, no Discard, no editable field — reopening a
        live review over a finished adoption would invite a second claim on a spent attempt.

        Offered only while the proposal is still in memory. After a remount there is nothing to
        show — the continuity cache is cleared on success — and a button that opens an empty panel
        would be a worse answer than no button.
      */
      <section className="flex flex-col rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-3.5 py-2.5" data-testid="program-applied">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-emerald-200/90">✓ Added to your training.</p>
          {proposal ? (
            <button
              type="button"
              onClick={() => setAdoptedDraftOpen((open) => !open)}
              aria-expanded={adoptedDraftOpen}
              aria-controls="program-adopted-draft"
              data-testid="program-applied-toggle"
              /* 44px: this is the control G2 depends on, and it is tapped with a thumb. Measured
                 at 24px on the first pass, which is below the target size used everywhere else
                 in this Builder. `-my-*` keeps the collapsed row compact while the hit area is
                 full size — the tappable box grows, the visual row does not. */
              className="-my-2 flex min-h-[44px] shrink-0 items-center rounded-lg px-2 text-xs font-medium text-emerald-100/80 hover:bg-emerald-400/10"
            >
              {adoptedDraftOpen ? "Hide BTY draft ▴" : "Review BTY draft ▾"}
            </button>
          ) : null}
        </div>
        {adoptedDraftOpen && proposal ? (
          <div
            id="program-adopted-draft"
            data-testid="program-applied-draft"
            className="mt-2.5 flex flex-col gap-3 border-t border-emerald-400/20 pt-2.5"
          >
            <p className="text-xs leading-5 text-emerald-100/60">
              What BTY drafted, for reference. Your training already has the version you approved — edit it in the
              learner preview below.
            </p>
            {proposal.elements.map((e) => (
              <div key={e.kind} className="flex flex-col gap-1" data-testid={`program-adopted-section-${e.kind}`}>
                <span className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#C9A66B]/75">
                  {KIND_LABEL[e.kind]}
                </span>
                <p className={READONLY_TEXT} data-surface="readonly">{e.content}</p>
              </div>
            ))}
          </div>
        ) : null}
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
        {/*
          The grammar, named once in words (Slice R4-R2E). The shapes below carry it on their own;
          this is for the Host who has not yet learned to read them.
        */}
        <p className="text-xs leading-5 text-white/40" data-testid="program-review-grammar">
          A gold box is yours to type in. Plain text with a line beside it is BTY’s wording, shown here to read.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" data-testid="program-title">
        {/*
          The "Editable" chip is gone (Slice R4-R2E-R3). It was `aria-hidden`, so it carried no
          accessible name — the `htmlFor` label does, and is untouched. The gold field treatment
          says "you can type here" on its own; the chip only repeated it.
        */}
        <label htmlFor="program-title-input" className="text-xs uppercase tracking-[0.12em] text-white/40">
          Program title
        </label>
        <input
          id="program-title-input"
          value={titleEdit}
          onChange={(e) => {
            setTitleEdit(e.target.value);
            setTitleDecision("edit");
          }}
          data-testid="program-title-input"
          data-surface="editable"
          className={`${EDITABLE_FIELD} text-base`}
        />
      </div>

      {p.elements.map((e) => {
        const derived = derivedContent(e.kind);
        /*
          OWNERSHIP, not availability (Slice 3.2L-R10-A.1). A BTY-owned section whose
          sentence cannot be rendered right now must go quiet — never fall back to the
          Host-narrative branch, which would show the string captured at generation time
          beside a trigger that no longer produces it.
        */
        const isDerived = contracts !== null && derivesFrom(e.kind, contracts);
        const unavailable = isDerived && derived === null;
        const wasAdjusted = sectionAdjusted(e.kind);
        const detailsOpen = openDetails === e.kind;
        /*
          THE HOST'S OWN SETTLED SENTENCE, IF THERE IS ONE (Slice R4-R2A-R1). Only a grounded
          host-authored element earns a preservation choice; everything else has nothing to
          preserve and keeps the plain "BTY drafted this" surface it always had.
        */
        const existing = currentByKind.get(e.kind);
        const preservable = isPreservableHostSection(existing);
        const isKeep = preservable && decisions[e.kind] === "keep";
        const sectionOpen = openSection === e.kind;
        /*
          THE STATE, IN TWO WORDS (Slice R4-R2E-R4). The collapsed row has to answer "what is
          going to happen to this section?" without opening it, or folding the detail away would
          just hide the decision. Derived from exactly the same values the badge below uses, so
          the summary and the detail can never disagree.
        */
        const stateLabel = unavailable
          ? "Needs a repeating moment"
          : isKeep
            ? "Keep yours"
            : wasAdjusted || (!isDerived && decisions[e.kind] === "edit")
              ? "Edited"
              : "Use BTY";
        /*
          One line of what the section will ACTUALLY say — which is not the same question as
          "what does this section render". A KEEP applies the Host's existing sentence and never
          reaches `sectionText`, exactly as `apply()` builds its choices; previewing the derived
          text there would have put "Keep yours" beside BTY's words. Caught by its own test.
        */
        const preview = unavailable ? "" : isKeep ? (existing?.content ?? "") : sectionText(e.kind, e.content);
        return (
          <div key={e.kind} className="flex flex-col rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" data-testid={`program-section-${e.kind}`}>
            {/*
              THE SUMMARY ROW IS THE CONTROL. A whole-row button, so the tap target is the row
              rather than a chevron, and `aria-expanded` / `aria-controls` make it a real
              disclosure for a screen reader rather than a div that happens to react to clicks.
            */}
            <button
              type="button"
              onClick={() => setOpenSection(sectionOpen ? null : e.kind)}
              aria-expanded={sectionOpen}
              aria-controls={`program-section-body-${e.kind}`}
              data-testid={`program-section-toggle-${e.kind}`}
              className="-mx-1 flex min-h-[44px] w-full items-center gap-3 rounded-lg px-1 text-left hover:bg-white/[0.03]"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C9A66B]/85">{KIND_LABEL[e.kind]}</span>
                {preview ? (
                  <span className="truncate text-xs leading-5 text-white/55" data-testid={`program-section-preview-${e.kind}`}>
                    {preview}
                  </span>
                ) : null}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-2">
                <span
                  data-testid={`program-section-state-${e.kind}`}
                  className={`rounded-md px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] ${
                    unavailable ? "bg-amber-400/15 text-amber-200/90" : "bg-[#C9A66B]/15 text-[#C9A66B]/90"
                  }`}
                >
                  {stateLabel}
                </span>
                <span aria-hidden className="text-xs text-white/40">{sectionOpen ? "▴" : "▾"}</span>
              </span>
            </button>

            {/*
              THE FULL SECTION, UNCHANGED, ONE TAP AWAY. Nothing was removed — the comparison, the
              Keep/Use choice, the contract fields and the rationale are all still here, and still
              the same elements. Hidden with a `display:none` UTILITY rather than the `hidden`
              attribute on purpose: this wrapper carries `flex`, and Tailwind's `[hidden]` rule
              loses to a display utility of equal specificity depending on stylesheet order.
            */}
            <div
              id={`program-section-body-${e.kind}`}
              data-testid={`program-section-body-${e.kind}`}
              className={sectionOpen ? "mt-3 flex flex-col gap-2" : "hidden"}
            >
            <div className="flex items-center justify-between gap-3">
              <span className="sr-only">{KIND_LABEL[e.kind]}</span>
              {/*
                "Adjusted by you", not "Your rewrite": for a derived section the sentence is
                still deterministically rendered by BTY — from values the Host changed. Calling
                that the Host's rewrite would be as inaccurate as calling it BTY's own draft.
              */}
              {/*
                NO BADGE while a BTY-owned section has no sentence (Slice 3.2L-R10-A.1).
                "Drafted by BTY" over stale text was the misleading half of the defect: it
                claimed authorship of a moment the current trigger no longer produces.
              */}
              {unavailable ? null : (
                <span className="rounded-md bg-[#C9A66B]/15 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#C9A66B]/90">
                  {/* A kept section is the Host's own earlier statement — neither BTY's draft
                      nor an adjustment made in this review (Slice R4-R2A-R1). */}
                  {/*
                      THE HOST'S OWN SENTENCE IS NOT BTY'S DRAFT (Slice R4-R5C14A). THE STANDARD
                      and WHAT SUCCESS LOOKS LIKE are carried verbatim from their Builder
                      answers, so the badge says where they came from rather than claiming BTY
                      wrote them.
                  */}
                  {isKeep
                    ? "Your wording"
                    : wasAdjusted || (!isDerived && decisions[e.kind] === "edit")
                      ? "Adjusted by you"
                      : isHostAuthoredKind(e.kind)
                        ? "From your setup"
                        : "Drafted by BTY"}
                </span>
              )}
            </div>

            {/*
              PRESERVATION CHOICE (Slice R4-R2A-R1). Both versions are on screen together,
              because a Host cannot consent to a replacement they cannot read. The choice is
              explicit in BOTH directions — there is no silent winner.
            */}
            {preservable ? (
              <div
                className="flex flex-col gap-2 rounded-lg border border-[#C9A66B]/25 bg-[#C9A66B]/[0.05] px-3 py-2.5"
                data-testid={`program-keep-choice-${e.kind}`}
              >
                <span className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#C9A66B]/75">
                  Your wording
                </span>
                {/* Already settled, and not changed from here — read-only grammar (R4-R2E). */}
                <p
                  className={READONLY_TEXT}
                  data-surface="readonly"
                  data-testid={`program-current-${e.kind}`}
                >
                  {existing?.content}
                </p>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <button
                    type="button"
                    aria-pressed={isKeep}
                    onClick={() => setDecisions((s) => ({ ...s, [e.kind]: "keep" }))}
                    data-testid={`program-keep-${e.kind}`}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${isKeep ? "bg-[#C9A66B] text-[#0B1F3A]" : "border border-white/15 text-white/65 hover:bg-white/[0.06]"}`}
                  >
                    Keep current
                  </button>
                  <button
                    type="button"
                    aria-pressed={!isKeep}
                    onClick={() => setDecisions((s) => ({ ...s, [e.kind]: "use" }))}
                    data-testid={`program-use-${e.kind}`}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${!isKeep ? "bg-[#C9A66B] text-[#0B1F3A]" : "border border-white/15 text-white/65 hover:bg-white/[0.06]"}`}
                  >
                    Use BTY draft
                  </button>
                </div>
                <span className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-white/35">
                  BTY’s draft
                </span>
              </div>
            ) : null}

            {isDerived ? (
              <>
                {/*
                  READ-ONLY derived text plus structured controls (pattern A). Six free
                  textareas let one section drift from another; adjusting the shared values
                  cannot, because every dependent sentence re-renders from them.
                */}
                {unavailable ? (
                  /*
                    Deliberately SHORT and not styled as participant content — the long
                    explanation already sits once at the bottom of the review, and repeating
                    it in every affected section would read as the program itself.
                  */
                  <p className="border-l-2 border-dashed border-white/15 pl-3 text-sm leading-6 text-white/45" data-surface="readonly" data-testid={`program-unavailable-${e.kind}`}>
                    Waiting on a moment that comes round again, in “When should they do it?” above.
                  </p>
                ) : (
                  /*
                    NOT A FIELD (Slice R4-R2E). This sentence is written by BTY from the shared
                    contract; the way to change it is "Edit details" below, which opens the values
                    it is rendered from. It used to wear the editable textarea's exact class string.
                  */
                  <p className={READONLY_TEXT} data-surface="readonly" data-testid={`program-derived-${e.kind}`}>
                    {derived}
                  </p>
                )}
                {/*
                  WHY THIS MATTERS is derived from the training setup, not from anything
                  adjustable here, so it gets the explanation instead of a control that
                  would open an empty panel (Slice 3.2L-R9).
                */}
                {(DETAIL_FIELDS[e.kind]?.length ?? 0) === 0 ? (
                  <p className="text-xs leading-5 text-white/40" data-testid={`program-derived-note-${e.kind}`}>
                    This comes from the problem you described in your training setup, and isn’t rewritten here.
                  </p>
                ) : (
                <button
                  type="button"
                  onClick={() => setOpenDetails(detailsOpen ? null : e.kind)}
                  aria-expanded={detailsOpen}
                  data-testid={`program-details-toggle-${e.kind}`}
                  className="self-start rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/[0.06]"
                >
                  {detailsOpen ? "Done" : "Edit details"}
                </button>
                )}
                {detailsOpen ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3" data-testid={`program-details-${e.kind}`}>
                    {DETAIL_FIELDS[e.kind]?.map((f, i, all) => (
                      <div key={f.id} className="flex flex-col gap-1">
                        {/*
                          One heading per concept group (Slice 3.2L-R9.2). Rendered when the
                          group CHANGES, so the panel gains two short headings and no extra
                          step, modal or scroll depth.
                        */}
                        {f.group && f.group !== all[i - 1]?.group ? (
                          <span
                            data-testid={`program-field-group-${f.group}`}
                            className={`text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#C9A66B]/75 ${i > 0 ? "mt-2 border-t border-white/10 pt-3" : ""}`}
                          >
                            {FIELD_GROUP_HEADING[f.group]}
                          </span>
                        ) : null}
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-white/45">{f.label}</span>
                        {f.options ? (
                          <select
                            value={f.get(contracts!) ?? ""}
                            onChange={(ev) => {
                              setContracts((c) => (c ? f.set(c, ev.target.value) : c));
                            }}
                            data-testid={`program-field-${f.id}`}
                            data-surface="editable"
                            className={`${EDITABLE_FIELD_FRAME} bg-[#0B1F3A] text-sm`}
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
                            data-surface="editable"
                            className={`${EDITABLE_FIELD} text-sm leading-6`}
                          />
                        )}
                      </label>
                      </div>
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
              <div className="flex flex-col gap-1.5">
                <AutoTextarea
                  value={edits[e.kind] ?? e.content}
                  onChange={(next) => {
                    setEdits((s) => ({ ...s, [e.kind]: next }));
                    setDecisions((s) => ({ ...s, [e.kind]: "edit" }));
                  }}
                  rows={3}
                  aria-label={KIND_LABEL[e.kind]}
                  data-testid={`program-edit-${e.kind}`}
                  data-surface="editable"
                  className={`${EDITABLE_FIELD} text-sm leading-6`}
                />
              </div>
            )}
            <p className="text-xs leading-5 text-white/40">{e.rationale}</p>
            </div>
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
      {proposalIsStale ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/[0.05] px-4 py-3 text-sm leading-6 text-amber-100/85" data-testid="program-stale-block">
          Your training answers changed after BTY wrote this. Nothing was added — draft the program again so it
          matches what your training says now.
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => void apply()}
          disabled={reviewBlock !== null || proposalIsStale}
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
            /*
              Reset restores the review AS IT OPENED, not "everything BTY" (Slice R4-R2A-R1).
              Discarding the Host's own settled sentences is not an undo of their edits, and a
              Host who genuinely wants BTY's version everywhere has a per-section control.
            */
            setDecisions(initialSectionDecisions(journey, p));
            setTitleEdit(p.displayTitle);
            setTitleDecision("use");
            setOpenDetails(null);
          }}
          data-testid="program-reset"
          className="text-sm text-white/55"
        >
          Reset to BTY’s draft
        </button>
        <button
          type="button"
          onClick={() => {
            // Discard is an explicit "not this one" — it ends the continuity too.
            clearCachedProposal(draftId);
            resumedRef.current = true;
            setPhase("idle");
          }}
          data-testid="program-discard"
          className="text-sm text-white/55"
        >
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
