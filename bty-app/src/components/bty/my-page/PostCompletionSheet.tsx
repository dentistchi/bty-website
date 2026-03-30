"use client";

import { Modal } from "@/components/ui/Modal";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type PostCompletionSheetProps = {
  open: boolean;
  onClose: () => void;
  locale: string;
  narrative: string | null;
};

/** Completion feedback after action-loop QR commit (render-only; data from server via parent). */
export function PostCompletionSheet({ open, onClose, locale, narrative }: PostCompletionSheetProps) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).actionContract;

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel={t.completedTitle}
      panelDataTestId="post-completion-sheet"
    >
      <div className="p-6">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">{t.completedTitle}</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-white/70">{t.completedBody}</p>
        {narrative ? (
          <p className="mt-4 text-sm leading-relaxed text-gray-800 dark:text-white/85">{narrative}</p>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/20"
        >
          {t.dismiss}
        </button>
      </div>
    </Modal>
  );
}
