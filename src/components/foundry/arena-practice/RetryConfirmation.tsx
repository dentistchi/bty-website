"use client";

import { useEffect, useRef } from "react";

/**
 * THE ONE PERMITTED SAME-INPUT SECOND ATTEMPT (Slice 3.2I-R5B2-R5C-4B-R1).
 *
 * Opening this surface sends nothing. Only its final action carries the acknowledgement, so a Host
 * who reaches it by accident spends nothing by looking. It is deliberately honest that the result
 * may be refused again — promising otherwise is what makes a second attempt feel free.
 */

export type RetryConfirmationCopy = {
  title: string;
  unchangedLine: string;
  oneAttemptLine: string;
  mayStillFailLine: string;
  reviewSetupCta: string;
  confirmCta: string;
  cancelCta: string;
};

export function RetryConfirmation({
  open,
  copy,
  submitting,
  onReviewSetup,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  copy: RetryConfirmationCopy;
  submitting: boolean;
  onReviewSetup: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
      // Escape closes WITHOUT submitting: the only way to spend is the explicit action.
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="retry-confirm-title"
        data-testid="retry-confirmation"
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-2xl border border-white/[0.12] bg-[#141414] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
      >
        <h2 id="retry-confirm-title" ref={headingRef} tabIndex={-1} className="text-[1.05rem] font-medium leading-7 text-white/90 outline-none">
          {copy.title}
        </h2>

        <ul className="flex flex-col gap-2 text-[0.92rem] leading-6 text-white/65">
          <li className="break-words">{copy.unchangedLine}</li>
          <li className="break-words">{copy.oneAttemptLine}</li>
          <li className="break-words">{copy.mayStillFailLine}</li>
        </ul>

        <div className="flex flex-col gap-2">
          {/* Reviewing the setup is the recommended path, so it is the emphasised one here too. */}
          <button
            type="button"
            onClick={onReviewSetup}
            data-testid="retry-confirm-review"
            className="w-full rounded-xl border border-[#C9A66B]/60 bg-[#C9A66B]/[0.10] px-4 py-3 text-[0.95rem] font-medium text-white"
          >
            {copy.reviewSetupCta}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            data-testid="retry-confirm-submit"
            className="w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-3 text-[0.95rem] text-white/75 disabled:opacity-50"
          >
            {copy.confirmCta}
          </button>
          <button
            type="button"
            onClick={onCancel}
            data-testid="retry-confirm-cancel"
            className="w-full rounded-xl px-4 py-2.5 text-[0.9rem] text-white/50"
          >
            {copy.cancelCta}
          </button>
        </div>
      </div>
    </div>
  );
}
