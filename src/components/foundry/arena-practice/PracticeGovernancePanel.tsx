"use client";

import { resolveGovernanceView, type Governance } from "./practiceGovernance";

/**
 * THE HOST'S VIEW OF WHY GENERATION IS OR IS NOT AVAILABLE (Slice 3.2I-R5B2-R5C-4B-R1).
 *
 * R5C-4A2 moved the admission decision to the server precisely because the client kept the action
 * available when retriability was unknown. This panel therefore RENDERS the server's answer and
 * computes nothing: no local refusal counting, no attempt history, no inference.
 *
 * It shows a Host what happened and what to do, in their language — never a reason code, an
 * identifier, a provider detail, or a claim about cost or likelihood.
 */

export type GovernancePanelCopy = {
  readyTitle: string;
  confirmTitle: string;
  confirmBody: string;
  revisionRequiredTitle: string;
  revisionRequiredBody: string;
  inProgressTitle: string;
  inProgressBody: string;
  unavailableTitle: string;
  unavailableBody: string;
  systemBlockedTitle: string;
  systemBlockedBody: string;
  reviewSetupCta: string;
  tryOnceMoreCta: string;
};

export function PracticeGovernancePanel({
  governance,
  copy,
  onReviewSetup,
  onTryOnceMore,
  tryOnceMoreRef,
}: {
  governance: Governance | null | undefined;
  copy: GovernancePanelCopy;
  onReviewSetup: () => void;
  onTryOnceMore: () => void;
  /** Focus returns here when the confirmation closes. */
  tryOnceMoreRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const view = resolveGovernanceView(governance);

  // READY says nothing about a refusal, because under this input none has happened. A standing
  // warning would train Hosts to ignore the one that matters.
  if (view.state === "ready") return null;

  const { title, body } =
    view.state === "confirm_second_attempt"
      ? { title: copy.confirmTitle, body: copy.confirmBody }
      : view.state === "revision_required"
        ? { title: copy.revisionRequiredTitle, body: copy.revisionRequiredBody }
        : view.state === "system_blocked"
          ? { title: copy.systemBlockedTitle, body: copy.systemBlockedBody }
          : view.state === "in_progress"
            ? { title: copy.inProgressTitle, body: copy.inProgressBody }
            : { title: copy.unavailableTitle, body: copy.unavailableBody };

  const blocked = !governance || view.primary === "none";

  return (
    <section
      // `status` rather than `alert`: it must not interrupt a Host mid-typing.
      role="status"
      aria-live="polite"
      data-testid="practice-governance-panel"
      data-governance-state={view.state}
      className="flex w-full max-w-full flex-col gap-3 rounded-2xl border border-white/[0.12] bg-white/[0.04] p-4"
    >
      <div className="flex items-start gap-2.5">
        {/* Never colour alone: the icon and the heading both carry the meaning. */}
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-[0.95rem] leading-6 text-[#C9A66B]">
          {blocked ? "■" : "▲"}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="text-[0.98rem] font-medium leading-6 text-white/90">{title}</h3>
          <p className="whitespace-pre-line break-words text-[0.9rem] leading-6 text-white/65">{body}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {view.primary === "review_setup" ? (
          <button
            type="button"
            onClick={onReviewSetup}
            data-testid="governance-review-setup"
            className="w-full rounded-xl border border-[#C9A66B]/60 bg-[#C9A66B]/[0.10] px-4 py-3 text-[0.95rem] font-medium text-white sm:w-auto"
          >
            {copy.reviewSetupCta}
          </button>
        ) : null}

        {/* Present ONLY at confirm_second_attempt. At revision_required it does not exist at all —
            a disabled retry would still read as "there is a way through here". */}
        {view.showsRetryAction ? (
          <button
            type="button"
            ref={tryOnceMoreRef}
            onClick={onTryOnceMore}
            data-testid="governance-try-once-more"
            className="w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-3 text-[0.95rem] text-white/75 sm:w-auto"
          >
            {copy.tryOnceMoreCta}
          </button>
        ) : null}
      </div>
    </section>
  );
}
