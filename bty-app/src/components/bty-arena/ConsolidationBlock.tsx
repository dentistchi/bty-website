"use client";

import React from "react";

const STEP6_TITLE = { en: "Step 6 · Consolidation", ko: "Step 6 · 정리" };
const YOU_CHOSE = { en: "You chose", ko: "선택한 항목" };
const KEY_INSIGHT = { en: "Key insight:", ko: "핵심 통찰:" };
const PRINCIPLE = {
  en: "Principle: \"Stabilize people first, then fix the system.\"",
  ko: "원칙: \"사람을 먼저 안정시키고, 그다음 시스템을 고칩니다.\"",
};
const COMPLETE_BTN = { en: "Complete", ko: "완료" };
const REFLECTION_BONUS = { en: "Reflection bonus", ko: "성찰 보너스" };

export type ConsolidationBlockProps = {
  locale: string;
  choiceId: string;
  intent: string;
  microInsight: string;
  lastXp: number;
  reflectionBonusXp: number;
  onComplete: () => void;
};

export function ConsolidationBlock({
  locale,
  choiceId,
  intent,
  microInsight,
  lastXp,
  reflectionBonusXp,
  onComplete,
}: ConsolidationBlockProps) {
  const isKo = locale === "ko";
  const totalXp = lastXp + reflectionBonusXp;
  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        border: "1px solid #eee",
        borderRadius: 14,
        background: "rgba(0,0,0,0.02)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{isKo ? STEP6_TITLE.ko : STEP6_TITLE.en}</div>
      <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.9, marginBottom: 12 }}>
        {reflectionBonusXp > 0 && (
          <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>
            XP +{lastXp} + {isKo ? REFLECTION_BONUS.ko : REFLECTION_BONUS.en} +{reflectionBonusXp} = +{totalXp}
          </p>
        )}
        {reflectionBonusXp === 0 && (
          <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>XP +{lastXp}</p>
        )}
        <p style={{ margin: "0 0 8px 0" }}>
          {isKo ? YOU_CHOSE.ko : YOU_CHOSE.en} {choiceId} ({intent}).
        </p>
        <p style={{ margin: "0 0 8px 0" }}>
          {isKo ? KEY_INSIGHT.ko : KEY_INSIGHT.en} {microInsight}
        </p>
        <p style={{ margin: 0 }}>{isKo ? PRINCIPLE.ko : PRINCIPLE.en}</p>
      </div>
      <button
        onClick={onComplete}
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid #111",
          background: "#111",
          color: "white",
          cursor: "pointer",
        }}
      >
        {isKo ? COMPLETE_BTN.ko : COMPLETE_BTN.en}
      </button>
    </div>
  );
}
