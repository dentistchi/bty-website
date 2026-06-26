"use client";

import { Modal } from "@/components/ui/Modal";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type PostCompletionSheetProps = {
  open: boolean;
  onClose: () => void;
  locale: string;
  /** The action the actor just completed — re-shown so they see what they did. */
  contractDescription: string | null;
  /** Optional server-provided narrative line. */
  narrative?: string | null;
};

/**
 * D2 actor-return completion sheet (render-only; data from parent).
 * Structure: headline → completed action → reflection prompt → display-only input → continue.
 * The reflection input is intentionally display-only: it is never read, submitted, or persisted
 * (no DB, no localStorage). The point is to prompt meaning, not collect data.
 */
export function PostCompletionSheet({
  open,
  onClose,
  locale,
  contractDescription,
  narrative = null,
}: PostCompletionSheetProps) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).actionContract;

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel={t.actorCompletedTitle}
      panelDataTestId="post-completion-sheet"
    >
      <div className="p-6">
        {/* 1. Completion headline */}
        <p className="text-lg font-semibold text-gray-900 dark:text-white">{t.actorCompletedTitle}</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-white/70">{t.actorCompletedBody}</p>

        {/* 2. Completed action description */}
        {contractDescription ? (
          <div className="mt-4 rounded-xl border border-[#E8E3D8] bg-[#FAF8F3] p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-[11px] font-medium uppercase tracking-widest text-[#667085] dark:text-white/50">
              {t.witnessPromiseTitle}
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-[#1E2A38] dark:text-white/90">
              {contractDescription}
            </p>
          </div>
        ) : null}

        {narrative ? (
          <p className="mt-4 text-sm leading-relaxed text-gray-800 dark:text-white/85">{narrative}</p>
        ) : null}

        {/* 3. Reflection prompt + 4. display-only input (never saved) */}
        <p className="mt-5 text-sm font-medium text-gray-800 dark:text-white/85">
          {t.actorReflectionPrompt}
        </p>
        <textarea
          aria-label={t.actorReflectionPrompt}
          rows={2}
          data-testid="actor-reflection-input"
          className="mt-2 w-full resize-none rounded-lg border border-[#E8E3D8] bg-white px-3 py-2 text-sm text-[#1E2A38] outline-none focus:border-[#1E2A38] dark:border-white/15 dark:bg-white/5 dark:text-white/90"
        />

        {/* 5. Continue CTA */}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-[#1E2A38] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2A3A4D]"
        >
          {t.actorContinueCta}
        </button>
      </div>
    </Modal>
  );
}
