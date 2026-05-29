"use client";

import { QRCodeSVG } from "qrcode.react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type ActionLoopQrPanelProps = {
  url: string;
  onDismiss: () => void;
  locale: string;
};

export function ActionLoopQrPanel({ url, onDismiss, locale }: ActionLoopQrPanelProps) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const tAction = getMessages(loc).actionContract;
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.05]">
      <QRCodeSVG
        key={url}
        value={url}
        size={200}
        bgColor="#ffffff"
        fgColor="#1a1a1a"
        level="M"
      />
      <pre
        data-testid="qr-debug-value"
        className="max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-black/5 px-2 py-1 text-[11px] text-black/70 dark:bg-white/10 dark:text-white/70"
      >
        {url}
      </pre>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs text-white/40 hover:text-white/70"
      >
        {tAction.dismiss}
      </button>
    </div>
  );
}
