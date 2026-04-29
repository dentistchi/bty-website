"use client";

import React from "react";
import type { ActionDecisionBlock } from "@/lib/bty/scenario/types";
import type { Locale } from "@/lib/i18n";
import { getMessages } from "@/lib/i18n";

export type EliteActionDecisionStepProps = {
  locale: Locale | string;
  block: ActionDecisionBlock;
  onChoice: (choiceId: string) => void | Promise<void>;
  choiceDisabled?: boolean;
};

/**
 * Step 5 — Action commitment: distinct from tradeoff “cost” framing; emphasizes real-world follow-through vs hold.
 */
export function EliteActionDecisionStep({
  locale,
  block,
  onChoice,
  choiceDisabled = false,
}: EliteActionDecisionStepProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  const [lockedId, setLockedId] = React.useState<string | null>(null);

  const prompt =
    lang === "ko" && typeof block.promptKo === "string" && block.promptKo.trim() !== ""
      ? block.promptKo.trim()
      : block.prompt;

  const handlePick = async (id: string) => {
    if (choiceDisabled || lockedId != null) return;
    setLockedId(id);
    try {
      await Promise.resolve(onChoice(id));
    } catch {
      setLockedId(null);
    }
  };

  return (
    <div
      data-testid="elite-action-decision-step"
      className="mt-2 space-y-4"
      role="region"
      aria-label={t.eliteActionDecisionRegionAria}
    >
      <div className="rounded-3xl border-2 border-bty-border/90 p-4 shadow-sm ring-1 ring-[var(--arena-accent)]/25">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-bty-navy/70">
          {t.eliteActionDecisionTitle}
        </p>
        <p className="mt-2 m-0 text-sm font-semibold leading-snug text-bty-navy">{t.eliteActionDecisionLead}</p>
        {prompt ? (
          <p className="mt-2 m-0 text-sm leading-snug text-bty-navy/90">{prompt}</p>
        ) : null}
      </div>

      <div>
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-bty-navy/75">
          {t.eliteDecisionRequiredHeader}
        </p>
        <ul className="m-0 mt-3 grid list-none gap-3 p-0">
          {block.choices.map((c) => {
            const isSelected = lockedId === c.id;
            const isDimmed = lockedId != null && !isSelected;
            const commitment =
              typeof c.commitment === "string" && c.commitment.trim() !== "" ? c.commitment.trim() : null;
            const isCommitmentPath = c.meaning?.is_action_commitment === true;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  data-testid={`elite-action-decision-${c.id}`}
                  onClick={() => handlePick(c.id)}
                  disabled={choiceDisabled || (lockedId != null && !isSelected)}
                  className={[
                    "w-full rounded-3xl border-2 px-5 py-4 text-left transition-[opacity,box-shadow] duration-200",
                    isCommitmentPath
                      ? "border-emerald-600/40 bg-emerald-50/40"
                      : "border-slate-400/45 bg-slate-50/80",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--arena-accent)]/50",
                    "hover:border-[var(--arena-accent)]/55",
                    isDimmed ? "opacity-45" : "opacity-100",
                    isSelected ? "ring-2 ring-[var(--arena-accent)]/45" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                      isCommitmentPath ? "bg-emerald-700 text-white" : "bg-slate-600 text-white",
                    ].join(" ")}
                    data-testid={`elite-action-decision-kind-${c.id}`}
                  >
                    {isCommitmentPath ? t.eliteActionDecisionAdCommitmentBadge : t.eliteActionDecisionAdDeferBadge}
                  </span>
                  <span className="mt-2 block text-[15px] font-semibold leading-snug text-bty-navy">{c.label}</span>
                  <ul
                    className="m-0 mt-2 list-disc space-y-1 pl-4 text-xs leading-snug text-bty-navy/88"
                    data-testid={`elite-action-decision-traits-${c.id}`}
                  >
                    {isCommitmentPath ? (
                      <>
                        <li>{t.eliteActionDecisionAd1TraitConcrete}</li>
                        <li>{t.eliteActionDecisionAd1TraitTimeBound}</li>
                        <li>{t.eliteActionDecisionAd1TraitObservable}</li>
                        <li>{t.eliteActionDecisionAd1TraitContractGate}</li>
                      </>
                    ) : (
                      <>
                        <li>{t.eliteActionDecisionAd2TraitDelay}</li>
                        <li>{t.eliteActionDecisionAd2TraitNonCommitment}</li>
                        <li>{t.eliteActionDecisionAd2TraitNextOrReexposure}</li>
                      </>
                    )}
                  </ul>
                  {commitment ? (
                    <span className="mt-2 block text-xs font-medium uppercase tracking-wide text-bty-secondary">
                      {t.eliteActionDecisionCommitmentLabel}
                    </span>
                  ) : null}
                  {commitment ? (
                    <span className="mt-1 block text-sm leading-relaxed text-bty-navy/85">{commitment}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
