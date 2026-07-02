"use client";

/**
 * ExitLine — a short line that sends the user back to real life (Scope Lock §1, §14).
 */
import React from "react";
import { getMessages, type Locale } from "@/lib/i18n";

export function ExitLine({ locale }: { locale: Locale }) {
  const m = getMessages(locale);
  return (
    <p className="px-1 pt-2 text-center text-xs text-white/40">{m.today.dailyOs.exitLine}</p>
  );
}
