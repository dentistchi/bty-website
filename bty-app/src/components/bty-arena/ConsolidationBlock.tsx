"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type ReflectResult = {
  summary: string;
  questions: string[];
  next_action: string;
  detected?: { tags: string[]; topTag?: string };
};

export type ConsolidationBlockProps = {
  locale: Locale | string;
  choiceId: string;
  intent: string;
  microInsight: string;
  lastXp: number;
  reflectionBonusXp: number;
  reflectResult?: ReflectResult | null;
  onComplete: () => void;
};

export function ConsolidationBlock({
  locale,
  choiceId,
  intent,
  microInsight,
  lastXp,
  reflectionBonusXp,
  reflectResult = null,
  onComplete,
}: ConsolidationBlockProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  const totalXp = lastXp + reflectionBonusXp;
  const regionLabel = lang === "ko" ? "반영 요약 및 다음" : "Reflection summary and next";
  return (
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
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{t.step6Title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.9, marginBottom: 12 }}>
        {reflectionBonusXp > 0 && (
          <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>
            XP +{lastXp} + {t.reflectionBonusLabel} +{reflectionBonusXp} = +{totalXp}
          </p>
        )}
        {reflectionBonusXp === 0 && (
          <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>XP +{lastXp}</p>
        )}
        <p style={{ margin: "0 0 8px 0" }}>
          {t.youChose} {choiceId} ({intent}).
        </p>
        <p style={{ margin: "0 0 8px 0" }}>
          {t.keyInsight} {microInsight}
        </p>
        <p style={{ margin: 0 }}>{t.principle}</p>

        {reflectResult && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #eee" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{t.deepeningTitle}</div>
            <p style={{ margin: "0 0 10px 0", fontSize: 13, opacity: 0.95 }}>{reflectResult.summary}</p>
            {reflectResult.questions.length > 0 && (
              <ul style={{ margin: "0 0 10px 0", paddingLeft: 20 }}>
                {reflectResult.questions.map((q, i) => (
                  <li key={i} style={{ marginBottom: 6, fontSize: 13 }}>{q}</li>
                ))}
              </ul>
            )}
            {reflectResult.next_action && (
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
                {t.nextActionLabel}: {reflectResult.next_action}
              </p>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onComplete}
        aria-label={t.completeBtn}
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid #111",
          background: "#111",
          color: "white",
          cursor: "pointer",
        }}
      >
        {t.completeBtn}
      </button>
    </div>
  );
}
