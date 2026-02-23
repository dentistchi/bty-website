"use client";

import React from "react";

export type CompleteBlockProps = {
  followUpSelectedLabel?: string | null;
  onContinue: () => void;
};

export function CompleteBlock({ followUpSelectedLabel, onContinue }: CompleteBlockProps) {
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
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Step 7 · Complete</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>
          이 시나리오 기록이 저장되었습니다. Continue로 다음 시나리오로 이동합니다.
        </div>
      </div>

      {followUpSelectedLabel != null && followUpSelectedLabel !== "" && (
        <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>FOLLOW-UP SELECTED</div>
          <div style={{ marginTop: 6, fontWeight: 700 }}>{followUpSelectedLabel}</div>
          <div style={{ marginTop: 10, opacity: 0.85 }}>
            다음 단계는 <b>Continue</b>로 진행합니다. (MVP: 1 + 보완 1 완료)
          </div>
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
          Continue → 다음 시나리오
        </button>
      </div>
    </>
  );
}
