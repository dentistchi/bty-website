"use client";

import React from "react";

const STEP7_TITLE = { en: "Step 7 · Complete", ko: "Step 7 · 완료" };
const STEP7_BODY = {
  en: "Saved. Use the button below to go to the next scenario.",
  ko: "저장되었습니다. 아래 버튼으로 다음 시나리오로 이동합니다.",
};
const NEXT_SCENARIO_BTN = { en: "Next scenario", ko: "다음 시나리오" };

export type CompleteBlockProps = {
  locale: string;
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
  const isKo = locale === "ko";
  const sectionLabel = followUpSelectedSectionLabel ?? (isKo ? "선택한 따라하기" : "FOLLOW-UP SELECTED");

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
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{isKo ? STEP7_TITLE.ko : STEP7_TITLE.en}</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>
          {isKo ? STEP7_BODY.ko : STEP7_BODY.en}
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
          {isKo ? NEXT_SCENARIO_BTN.ko : NEXT_SCENARIO_BTN.en}
        </button>
      </div>
    </>
  );
}
