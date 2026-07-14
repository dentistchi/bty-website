"use client";

import { QRCodeSVG } from "qrcode.react";
import type { EventRoomsCopy } from "./copy";

/**
 * The join QR. Rendered on a bright surface with a quiet white zone so it scans
 * from a screenshot on a navy background. The value is EXACTLY the current
 * join_url; a `key={url}` remount keeps it in lockstep after a rotation. An
 * sr-only copy of the URL supports tests. The raw token is never shown as a
 * fallback — if there is no URL, the panel simply renders nothing scannable.
 */
export function FoundryEventQr({ url, t }: { url: string; t: EventRoomsCopy }) {
  if (!url) {
    return <p className="text-sm text-white/50">{t.qrError}</p>;
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl bg-white p-4">
        <QRCodeSVG key={url} value={url} size={200} bgColor="#ffffff" fgColor="#0B1F3A" level="M" />
      </div>
      <span className="text-xs uppercase tracking-[0.14em] text-white/45">{t.scanToJoin}</span>
      <pre data-testid="foundry-qr-url" className="sr-only">
        {url}
      </pre>
    </div>
  );
}
