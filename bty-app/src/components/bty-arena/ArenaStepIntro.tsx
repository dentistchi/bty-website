"use client";

import React from "react";
import type { Locale } from "@/lib/i18n";
import { ScenarioIntro } from "./ScenarioIntro";
import { CardSkeleton } from "./CardSkeleton";

export type ArenaStepIntroProps = {
  locale: Locale | string;
  displayTitle: string;
  contextForUser: string;
  onStart: () => void;
  startLoading: boolean;
  runId: string | null;
};

export function ArenaStepIntro({
  locale, displayTitle, contextForUser, onStart, startLoading, runId,
}: ArenaStepIntroProps) {
  const isKo = locale === "ko";
  return (
    <>
      <ScenarioIntro
        locale={locale}
        title={displayTitle}
        context={contextForUser}
        onStart={onStart}
      />
      {startLoading && (
        <div style={{ marginTop: 10 }} aria-busy="true" aria-label={isKo ? "시나리오 시작 중…" : "Starting scenario…"}>
          <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
        </div>
      )}
      {!startLoading && runId === null && (
        <div style={{ marginTop: 10 }} aria-busy="true" aria-label={isKo ? "런 준비 중…" : "Preparing run…"}>
          <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
        </div>
      )}
    </>
  );
}
