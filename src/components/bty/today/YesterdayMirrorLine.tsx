"use client";

/**
 * YesterdayMirrorLine — one quiet line. Evidence exists → neutral mirror; no evidence →
 * neutral invitation. Never deficit language (Scope Lock §6). `hasEvidence` is decided by
 * the server gate (YESTERDAY_MIRROR vs QUIET_INVITATION/OPEN_DAY), not the client.
 */
import React from "react";
import { getMessages, type Locale } from "@/lib/i18n";

export function YesterdayMirrorLine({
  hasEvidence,
  locale,
}: {
  hasEvidence: boolean;
  locale: Locale;
}) {
  const m = getMessages(locale);
  const line = hasEvidence
    ? m.today.dailyOs.mirrorHasEvidence
    : m.today.dailyOs.mirrorNoEvidence;
  return <p className="px-1 text-sm leading-relaxed text-white/80">{line}</p>;
}
