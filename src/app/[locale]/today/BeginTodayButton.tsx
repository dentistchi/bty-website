"use client";

import { useState } from "react";
import { getMessages } from "@/lib/i18n";

// D3-0 Slice 1 — in-memory "begin today" ritual.
// tap → show confirmation → remain on the same surface.
// No navigation. No persistence. No analytics. No API.
export default function BeginTodayButton({ locale }: { locale: string }) {
  const [opened, setOpened] = useState(false);
  const t = getMessages(locale === "en" ? "en" : "ko").today;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpened(true)}
        disabled={opened}
        className="w-full rounded-2xl bg-[#1E2A38] px-4 py-4 text-base font-semibold text-white transition disabled:opacity-60"
      >
        {t.beginButton}
      </button>
      {opened ? (
        <p role="status" className="text-center text-sm leading-6 text-[#667085]">
          {t.beginConfirmation}
        </p>
      ) : null}
    </div>
  );
}
