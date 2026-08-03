"use client";

import { useMemo, useState } from "react";
import { AutoTextarea } from "./AutoTextarea";
import { guidedAnswersReady, resolveHardestWhenOptions, showsCustomText } from "./guidedQuestionOptions";
import { guidedAnswersChanged } from "@/domain/foundry/arena-draft/guidedSetupAnswers";
import type { HardestWhenOption } from "@/domain/foundry/arena-draft/types";

/**
 * REVIEW SETUP — SECTION A (Slice 3.2I-R5B2-R5C-4B-R1).
 *
 * R5C-4A1 measured these two answers had no write path, and R5C-4A2 then told Hosts to review their
 * setup. This is the surface that makes that instruction answerable.
 *
 * It uses the SAME option vocabulary as the creation flow rather than a second list, and shows the
 * free-text field only where generation actually reads it — offering it elsewhere would invite a
 * Host to write something the model never sees.
 *
 * SAVE IS SECTION-SCOPED, and deliberately so: guided answers and the boundary have separate server
 * mutations, and presenting one button over two sequential requests would claim an atomicity the
 * server does not provide. The boundary keeps its own existing editor and its own Save.
 */

export type ReviewSetupCopy = {
  heading: string;
  situationHeading: string;
  situationHelp: string;
  boundaryHeading: string;
  boundaryHelp: string;
  q1Label: string;
  q2Label: string;
  otherPlaceholder: string;
  pressurePlaceholder: string;
  saveCta: string;
  cancelCta: string;
  savingLabel: string;
  unsavedLabel: string;
  noGenerationNote: string;
  hardestWhen: Record<HardestWhenOption, string>;
};

export type GuidedAnswersValue = {
  hardestWhen: { choice: HardestWhenOption; customText?: string };
  avoidancePressure: { text: string };
};

export function ReviewSetupPanel({
  copy,
  current,
  sourceOptions,
  saving,
  errorText,
  onSave,
  onCancel,
  boundarySection,
}: {
  copy: ReviewSetupCopy;
  current: GuidedAnswersValue;
  sourceOptions: readonly string[] | null | undefined;
  saving: boolean;
  errorText: string | null;
  onSave: (next: GuidedAnswersValue) => void;
  onCancel: () => void;
  /** The EXISTING boundary editor, passed through untouched — never a second boundary model. */
  boundarySection?: React.ReactNode;
}) {
  const [choice, setChoice] = useState<HardestWhenOption>(current.hardestWhen.choice);
  const [custom, setCustom] = useState(current.hardestWhen.customText ?? "");
  const [pressure, setPressure] = useState(current.avoidancePressure.text);

  const options = useMemo(() => resolveHardestWhenOptions(sourceOptions), [sourceOptions]);

  const next: GuidedAnswersValue = {
    hardestWhen: showsCustomText(choice) ? { choice, customText: custom } : { choice },
    avoidancePressure: { text: pressure },
  };

  // The SAME domain comparison the server uses, so the button cannot promise a change the server
  // will then treat as a no-op.
  const changed = guidedAnswersChanged(current, next);
  const ready = guidedAnswersReady(choice, custom, pressure);

  return (
    <section aria-labelledby="review-setup-heading" data-testid="review-setup-panel" className="flex w-full max-w-full flex-col gap-5">
      <h2 id="review-setup-heading" tabIndex={-1} className="text-[1.05rem] font-medium leading-7 text-white/90 outline-none">
        {copy.heading}
      </h2>

      {/* ---- SECTION A — what kind of moment is generated ---------------- */}
      <fieldset className="flex min-w-0 flex-col gap-2.5 border-0 p-0">
        <legend className="mb-1 text-[0.95rem] font-medium text-white/85">{copy.situationHeading}</legend>
        <p className="break-words text-[0.85rem] leading-6 text-white/50">{copy.situationHelp}</p>

        <p className="mt-1 text-[0.85rem] text-white/60">{copy.q1Label}</p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={copy.q1Label}>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={choice === opt}
              onClick={() => setChoice(opt)}
              data-testid={`review-setup-choice-${opt}`}
              className={
                "w-full rounded-xl border px-4 py-3.5 text-left text-[0.95rem] leading-6 transition-colors " +
                (choice === opt
                  ? "border-[#C9A66B]/60 bg-[#C9A66B]/[0.08] text-white"
                  : "border-white/10 bg-white/[0.03] text-white/80")
              }
            >
              {copy.hardestWhen[opt]}
            </button>
          ))}
        </div>

        {showsCustomText(choice) ? (
          <label className="mt-1 flex flex-col gap-1.5">
            <span className="sr-only">{copy.otherPlaceholder}</span>
            <AutoTextarea
              value={custom}
              onChange={setCustom}
              placeholder={copy.otherPlaceholder}
              rows={2}
              className="w-full rounded-xl border border-white/12 bg-black/30 px-4 py-3 text-[0.95rem] text-white/90 outline-none placeholder:text-white/30"
            />
          </label>
        ) : null}

        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-[0.85rem] text-white/60">{copy.q2Label}</span>
          <AutoTextarea
            value={pressure}
            onChange={setPressure}
            placeholder={copy.pressurePlaceholder}
            rows={3}
            className="w-full rounded-xl border border-white/12 bg-black/30 px-4 py-3 text-[0.95rem] text-white/90 outline-none placeholder:text-white/30"
          />
        </label>

        {changed ? (
          <p data-testid="review-setup-unsaved" className="text-[0.82rem] text-[#C9A66B]/90">
            {copy.unsavedLabel}
          </p>
        ) : null}
        {errorText ? <p className="break-words text-[0.85rem] text-red-300/90">{errorText}</p> : null}

        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            // Disabled on a semantic no-op: the server would write nothing, and a Save that appears
            // to do something while changing nothing is how a Host concludes governance is broken.
            disabled={!changed || !ready || saving}
            onClick={() => onSave(next)}
            data-testid="review-setup-save"
            className="w-full rounded-xl border border-[#C9A66B]/60 bg-[#C9A66B]/[0.10] px-4 py-3 text-[0.95rem] font-medium text-white disabled:opacity-40 sm:w-auto"
          >
            {saving ? copy.savingLabel : copy.saveCta}
          </button>
          <button
            type="button"
            onClick={onCancel}
            data-testid="review-setup-cancel"
            className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-[0.95rem] text-white/75 sm:w-auto"
          >
            {copy.cancelCta}
          </button>
        </div>
        <p className="break-words text-[0.82rem] leading-6 text-white/45">{copy.noGenerationNote}</p>
      </fieldset>

      {/* ---- SECTION B — what the generated situation may contain -------- */}
      {boundarySection ? (
        <section aria-labelledby="review-boundary-heading" data-testid="review-setup-boundary" className="flex min-w-0 flex-col gap-2">
          <h3 id="review-boundary-heading" className="text-[0.95rem] font-medium text-white/85">
            {copy.boundaryHeading}
          </h3>
          <p className="break-words text-[0.85rem] leading-6 text-white/50">{copy.boundaryHelp}</p>
          {boundarySection}
        </section>
      ) : null}
    </section>
  );
}
