"use client";

import React from "react";

export type SystemMsg = { id: string; en: string; ko?: string };

export type ResultBlockProps = {
  locale: string;
  systemMessage: SystemMsg | null;
  lastXp: number;
  microInsight: string;
  result: string;
  onNext: () => void;
};

export function ResultBlock({ locale, systemMessage, lastXp, microInsight, result, onNext }: ResultBlockProps) {
  const systemText =
    systemMessage && (locale === "ko" && systemMessage.ko ? systemMessage.ko : systemMessage.en);

  return (
    <>
      {systemText && (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>{systemText}</div>
        </div>
      )}

      <div style={{ fontSize: 18, fontWeight: 700 }}>XP +{lastXp}</div>
      <div style={{ marginTop: 8, fontWeight: 600 }}>{microInsight}</div>
      <div style={{ marginTop: 10, lineHeight: 1.6, opacity: 0.9 }}>{result}</div>

      <div style={{ marginTop: 14 }}>
        <button
          onClick={onNext}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "white",
            cursor: "pointer",
          }}
        >
          {locale === "ko" ? "다음" : "Next"}
        </button>
      </div>
    </>
  );
}
