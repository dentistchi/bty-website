"use client";

import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export const MAIN_CONTENT_ID = "main-content";

/**
 * Skip link for keyboard/screen reader: first tab moves focus here; activates on focus-visible.
 */
export function SkipToMainContent({ locale }: { locale: Locale }) {
  const t = getMessages(locale).nav.skipToMainContent;
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="absolute -left-[9999px] top-3 z-[99999] rounded-lg border-2 border-current bg-white px-5 py-3 font-semibold no-underline text-inherit focus-visible:left-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:bg-gray-900"
    >
      {t}
    </a>
  );
}
