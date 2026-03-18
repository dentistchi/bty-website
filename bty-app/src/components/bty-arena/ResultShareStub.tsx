"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export function ResultShareStub({ locale }: { locale: string }) {
  const lang = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(lang).uxPhase1Stub;
  const [status, setStatus] = React.useState<"idle" | "ok" | "err">("idle");

  async function copyLine() {
    setStatus("idle");
    try {
      await navigator.clipboard.writeText(t.resultShareClipboardLine);
      setStatus("ok");
    } catch {
      setStatus("err");
    }
  }

  return (
    <div
      className="rounded-2xl border border-bty-border bg-bty-surface p-4"
      role="region"
      aria-label={t.resultShareRegionAria}
    >
      <button
        type="button"
        onClick={copyLine}
        className="w-full rounded-xl border border-bty-border bg-bty-soft px-4 py-3 text-sm font-semibold text-bty-text transition-colors hover:bg-bty-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel"
      >
        {t.resultShareCta}
      </button>
      {status === "ok" && (
        <p className="mt-2 text-center text-xs text-bty-secondary" role="status">
          {t.resultShareCopied}
        </p>
      )}
      {status === "err" && (
        <p className="mt-2 text-center text-xs text-red-700" role="alert">
          {t.resultShareFailed}
        </p>
      )}
    </div>
  );
}
