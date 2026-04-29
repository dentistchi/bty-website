"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { CardSkeleton } from "./CardSkeleton";

export type CompleteBlockProps = {
  locale: Locale | string;
  followUpSelectedLabel?: string | null;
  followUpSelectedSectionLabel?: string;
  onContinue: () => void;
  /** When true, show loading skeleton below the button (next scenario in flight). */
  loading?: boolean;
};

export function CompleteBlock({
  locale,
  followUpSelectedLabel,
  followUpSelectedSectionLabel,
  onContinue,
  loading = false,
}: CompleteBlockProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  const sectionLabel = followUpSelectedSectionLabel ?? t.followUpSelected;
  const loadingAriaLabel = lang === "ko" ? "다음 시나리오 불러오는 중…" : "Loading next scenario…";

  const regionLabel = lang === "ko" ? "시나리오 완료 및 다음" : "Scenario complete and next";
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
        role="region"
        aria-label={regionLabel}
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

      <div style={{ marginTop: 20 }} role="group" aria-label={lang === "ko" ? "다음 시나리오로" : "Continue to next scenario"}>
        <button
          onClick={onContinue}
          disabled={loading}
          aria-busy={loading}
          aria-label={t.nextScenario}
          style={{
            padding: "14px 20px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            width: "100%",
            maxWidth: 320,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {t.nextScenario}
        </button>
      </div>
      {loading && (
        <div style={{ marginTop: 10 }} aria-busy="true" aria-label={loadingAriaLabel}>
          <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
        </div>
      )}
    </>
  );
}
