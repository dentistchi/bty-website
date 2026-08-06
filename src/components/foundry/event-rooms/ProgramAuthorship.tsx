"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JourneyElementKind, RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";
import {
  applyProgramProposal,
  attributionKind,
  missingProgramKinds,
  type ProgramProposal,
  type SectionChoice,
  type SectionDecision,
} from "@/domain/foundry/module/program-authorship";
import { draftIdentityStatement, type BuilderAnswers } from "@/domain/foundry/module/module-builder";
import { Modal } from "@/components/ui/Modal";

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

export type ProgramGenerateOutcome =
  | { ok: true; proposal: ProgramProposal; evidenceCeiling: string; attemptId: string | null }
  | { ok: false; code: string; refusal?: string | null };

const FAILURE_COPY: Record<string, string> = {
  provider_unavailable: "Program drafting isn’t available right now. You can keep writing this training yourself — nothing was changed.",
  timeout: "Drafting took too long and was stopped. Your draft is untouched — start it again when you’re ready.",
  provider_error: "We couldn’t reach the drafting service. Your draft is untouched — start it again in a moment.",
  invalid_output: "BTY drafted something that didn’t meet our honesty rules, so we discarded it rather than show it to you. Your draft is untouched.",
  duplicate_intent: "That request was already sent. Refresh to see the result rather than drafting twice.",
  context_mismatch: "Your training changed since this draft was written. Generate it again so it matches.",
  // The draft was published, deleted or edited while BTY was writing. The proposal is
  // real but no longer applies to this training.
  stale_context: "This training changed while BTY was writing, so the draft no longer matches it. Nothing was changed — start it again when you're ready.",
  status_no_longer_draft: "This training was created as a session while BTY was writing, so the draft can no longer be added to it. Nothing was changed.",
  inputs_changed: "Your training changed since BTY started writing. Nothing was changed — start the draft again so it matches.",
  context_incomplete: "Add the problem, audience, behaviour and evidence first — BTY drafts from those.",
  source_identity_unavailable: "This build can’t identify itself, so drafting is disabled. Nothing was changed.",
};

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
  const [failure, setFailure] = useState<string>("");
  const [decisions, setDecisions] = useState<Record<string, SectionDecision>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [titleDecision, setTitleDecision] = useState<SectionDecision>("use");
  const [titleEdit, setTitleEdit] = useState("");

  const missing = useMemo(() => missingProgramKinds(answers, journey), [answers, journey]);

  // Opening the confirmation binds the target to THIS draft's loaded payload and calls
  // nothing. Zero parents, zero provider calls, zero draft writes.
  const openConfirmation = useCallback(() => {
    setTarget({ draftId, focus: draftIdentityStatement(answers) });
    setFailure("");
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
    setFailure("");
    onPendingChange?.(true);
    const r = await onGenerate();
    // The lease is released the moment the attempt reaches a terminal state, whichever
    // way it went — a failed generation must never leave publication wedged.
    onPendingChange?.(false);
    if (!r.ok) {
      setFailure(FAILURE_COPY[r.refusal ?? ""] ?? FAILURE_COPY[r.code] ?? FAILURE_COPY.invalid_output);
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

  const apply = useCallback(() => {
    if (!proposal) return;
    const choices: SectionChoice[] = proposal.elements.map((e) => ({
      kind: e.kind,
      decision: decisions[e.kind] ?? "use",
      editedContent: edits[e.kind],
    }));
    onApply(
      applyProgramProposal(journey, proposal, choices, { titleDecision, editedTitle: titleEdit }),
      attemptId,
    );
    setPhase("applied");
  }, [proposal, decisions, edits, journey, titleDecision, titleEdit, attemptId, onApply]);

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
          <p className="text-sm leading-6 text-amber-200/90" data-testid="program-failure">{failure}</p>
        ) : null}
        <button
          type="button"
          ref={generateButtonRef}
          onClick={openConfirmation}
          disabled={!ready}
          data-testid="program-generate"
          className="self-start rounded-xl bg-[#C9A66B] px-5 py-2.5 text-sm font-semibold text-[#0B1F3A] disabled:opacity-50"
        >
          {failure ? "Draft it again" : "Draft my training program"}
        </button>
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
        <Modal open onClose={cancelConfirmation} ariaLabel="Training program target" panelDataTestId="program-target-confirm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 border-l-2 border-[#C9A66B]/50 pl-3">
              <span className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-white/45">
                Training program target
              </span>
              {/* Bound at open time to THIS draft's loaded payload. Wraps fully so a long
                  focus keeps its distinguishing tail. */}
              <p
                data-testid={target.focus ? "program-target-focus" : "program-target-fallback"}
                data-target-draft-id={target.draftId}
                className={`break-words text-base font-medium leading-7 ${target.focus ? "text-white/90" : "text-white/45"}`}
              >
                {target.focus ?? "Untitled training draft"}
              </p>
            </div>

            <p className="text-sm leading-6 text-white/65">
              BTY will draft a program for this training focus. Nothing will be added or published until you review
              and apply it.
            </p>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse sm:justify-start">
              <button
                type="button"
                ref={confirmButtonRef}
                onClick={() => void generate()}
                disabled={submittingRef.current}
                data-testid="program-target-confirm-action"
                className="min-h-[44px] rounded-xl bg-[#C9A66B] px-5 py-3 text-sm font-semibold text-[#0B1F3A] disabled:opacity-60"
              >
                Draft program for this training
              </button>
              <button
                type="button"
                onClick={cancelConfirmation}
                disabled={submittingRef.current}
                data-testid="program-target-cancel"
                className="min-h-[44px] rounded-xl border border-white/15 px-5 py-3 text-sm text-white/70 disabled:opacity-40"
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
        const decision = decisions[e.kind] ?? "use";
        return (
          <div key={e.kind} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" data-testid={`program-section-${e.kind}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C9A66B]/85">{KIND_LABEL[e.kind]}</span>
              <span className="rounded-md bg-[#C9A66B]/15 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#C9A66B]/90">
                Drafted by BTY
              </span>
            </div>
            <textarea
              value={edits[e.kind] ?? e.content}
              onChange={(ev) => {
                setEdits((s) => ({ ...s, [e.kind]: ev.target.value }));
                setDecisions((s) => ({ ...s, [e.kind]: "edit" }));
              }}
              rows={3}
              data-testid={`program-edit-${e.kind}`}
              className="resize-none rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/85"
            />
            <div className="flex items-center gap-2">
              {(["use", "keep", "edit"] as SectionDecision[]).map((d) => {
                const label = d === "use" ? "Use this" : d === "keep" ? "Keep mine" : "My rewrite";
                const active = decision === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDecisions((s) => ({ ...s, [e.kind]: d }))}
                    data-testid={`program-decision-${e.kind}-${d}`}
                    aria-pressed={active}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      active ? "bg-[#C9A66B] text-[#0B1F3A]" : "border border-white/15 text-white/60 hover:bg-white/[0.06]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs leading-5 text-white/40">{e.rationale}</p>
          </div>
        );
      })}

      {ceiling ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" data-testid="program-evidence-ceiling">
          <span className="text-xs uppercase tracking-[0.12em] text-white/40">What this can and cannot show</span>
          <p className="mt-1 text-sm leading-6 text-white/70">{ceiling}</p>
          <p className="mt-1 text-sm leading-6 text-white/55">{p.evidenceLanguage}</p>
        </div>
      ) : null}

      {p.assumptions.length > 0 ? (
        <ListBlock title="This assumes" items={p.assumptions} testid="program-assumptions" />
      ) : null}
      {p.warnings.length > 0 ? (
        <ListBlock title="Worth noting" items={p.warnings} testid="program-warnings" tone="amber" />
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={apply}
          data-testid="program-apply"
          className="rounded-xl bg-[#C9A66B] px-5 py-2.5 text-sm font-semibold text-[#0B1F3A]"
        >
          Add this program to my training
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
