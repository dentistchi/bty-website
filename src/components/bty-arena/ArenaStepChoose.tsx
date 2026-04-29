"use client";

import React from "react";
import type { ScenarioChoice } from "@/lib/bty/scenario/types";
import type { Locale } from "@/lib/i18n";
import { ChoiceList } from "./ChoiceList";
import { PrimaryActions } from "./PrimaryActions";
import { CardSkeleton } from "./CardSkeleton";

export type ArenaStepChooseProps = {
  locale: Locale | string;
  choices: ScenarioChoice[];
  selectedChoiceId: string | null;
  onSelectChoice: (id: string) => void;
  onSelectOther: () => void;
  otherLabel: string;
  showActions: boolean;
  confirmDisabled: boolean;
  onConfirm: () => void;
  onContinue: () => void;
  confirmingChoice: boolean;
  hideChoiceIntentSlug?: boolean;
};

export function ArenaStepChoose({
  locale, choices, selectedChoiceId, onSelectChoice,
  onSelectOther, otherLabel, showActions, confirmDisabled,
  onConfirm, onContinue, confirmingChoice,
  hideChoiceIntentSlug = false,
}: ArenaStepChooseProps) {
  const isKo = locale === "ko";
  return (
    <>
      <ChoiceList
        locale={locale}
        choices={choices}
        selectedChoiceId={selectedChoiceId}
        onSelect={onSelectChoice}
        hideIntentSlug={hideChoiceIntentSlug}
      />
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={onSelectOther}
          aria-label={otherLabel}
          style={{
            padding: "12px 16px", borderRadius: 14,
            border: "1px solid #e5e5e5", background: "white",
            cursor: "pointer", fontSize: 14,
          }}
        >
          {otherLabel}
        </button>
      </div>
      {showActions && (
        <>
          <PrimaryActions
            locale={locale}
            confirmDisabled={confirmDisabled}
            continueDisabled
            onConfirm={onConfirm}
            onContinue={onContinue}
            showContinue={false}
          />
          {confirmingChoice && (
            <div style={{ marginTop: 10 }} aria-busy="true" aria-label={isKo ? "선택 확인 중…" : "Confirming choice…"}>
              <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
            </div>
          )}
        </>
      )}
    </>
  );
}
