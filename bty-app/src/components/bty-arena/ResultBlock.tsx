"use client";

import React from "react";

export type SystemMsg = { id: string; en: string; ko: string };

export type ResultBlockProps = {
  systemMessage: SystemMsg | null;
  lastXp: number;
  microInsight: string;
  result: string;
  onNext: () => void;
};

export function ResultBlock({ systemMessage, lastXp, microInsight, result, onNext }: ResultBlockProps) {
  return (
    <>
      {systemMessage && (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>{systemMessage.en}</div>
          <div style={{ opacity: 0.8, marginTop: 6 }}>{systemMessage.ko}</div>
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
          Next
        </button>
      </div>
    </>
  );
}
