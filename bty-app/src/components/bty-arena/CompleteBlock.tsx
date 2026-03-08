"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type CompleteBlockProps = {
  locale: Locale | string;
  followUpSelectedLabel?: string | null;
  followUpSelectedSectionLabel?: string;
  onContinue: () => void;
};

export function CompleteBlock({
  locale,
  followUpSelectedLabel,
  followUpSelectedSectionLabel,
  onContinue,
}: CompleteBlockProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  const sectionLabel = followUpSelectedSectionLabel ?? t.followUpSelected;

  return (
    <>
      <div
        style={{
          marginTop: 14,
          padding: 14,
          border: "1px solid #eee",
          borderRadius: 14,
          background: "rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.step7Title}</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>
          {t.step7Body}
        </div>
      </div>

      {followUpSelectedLabel != null && followUpSelectedLabel !== "" && (
        <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{sectionLabel}</div>
          <div style={{ marginTop: 6, fontWeight: 700 }}>{followUpSelectedLabel}</div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button
          onClick={onContinue}
          style={{
            padding: "14px 20px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
            width: "100%",
            maxWidth: 320,
          }}
        >
          {t.nextScenario}
        </button>
      </div>
    </>
  );
}
