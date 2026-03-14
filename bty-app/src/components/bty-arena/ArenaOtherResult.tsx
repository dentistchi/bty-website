"use client";

import React from "react";
import type { Locale } from "@/lib/i18n";
import type { SystemMsg } from "./ResultBlock";
import { CardSkeleton } from "./CardSkeleton";

export type ArenaOtherResultProps = {
  locale: Locale | string;
  freeResponseFeedback: { praise: string; suggestion: string } | null;
  systemMessage: SystemMsg | null;
  otherRecordedLabel: string;
  lastXp: number;
  nextScenarioLabel: string;
  onContinue: () => void;
  continueLoading: boolean;
};

export function ArenaOtherResult({
  locale, freeResponseFeedback, systemMessage, otherRecordedLabel,
  lastXp, nextScenarioLabel, onContinue, continueLoading,
}: ArenaOtherResultProps) {
  const isKo = locale === "ko";
  return (
    <div style={{ marginTop: 18, padding: 16, border: "1px solid #e5e5e5", borderRadius: 14 }}>
      {freeResponseFeedback ? (
        <>
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>{freeResponseFeedback.praise}</p>
          {freeResponseFeedback.suggestion && (
            <p style={{ margin: "0 0 8px", fontSize: 14, opacity: 0.9 }}>{freeResponseFeedback.suggestion}</p>
          )}
          <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>XP +{lastXp}</p>
        </>
      ) : (
        <>
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
            {isKo && systemMessage?.ko ? systemMessage.ko : systemMessage?.en ?? otherRecordedLabel}
          </p>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>XP +{lastXp}</p>
        </>
      )}
      <button
        type="button"
        onClick={onContinue}
        disabled={continueLoading}
        aria-label={nextScenarioLabel}
        style={{
          marginTop: 12, padding: "10px 20px", borderRadius: 10,
          border: "none", background: "#111", color: "white",
          cursor: continueLoading ? "not-allowed" : "pointer",
          fontSize: 14, opacity: continueLoading ? 0.6 : 1,
        }}
      >
        {nextScenarioLabel}
      </button>
      {continueLoading && (
        <div style={{ marginTop: 10 }} aria-busy="true" aria-label={isKo ? "다음 시나리오 불러오는 중…" : "Loading next scenario…"}>
          <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
        </div>
      )}
    </div>
  );
}
