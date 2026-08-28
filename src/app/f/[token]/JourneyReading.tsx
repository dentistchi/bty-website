import type { JourneyElementKind } from "@/domain/foundry/module/journey";

export type JourneyBlock = { id: string; kind: string; content: string };
export type Journey = { displayTitle: string; elements: JourneyBlock[] } | null;

/**
 * THE ONE LEARNER-FACING PRESENTATION OF AN AUTHORED PROGRAM (extracted in Slice 3.2R-R8A).
 *
 * This lived inside the YouTube learner client, so a PDF learner met the same published program
 * as one question under a label that said REFLECTION — the whole journey was frozen on the event
 * and simply never rendered. Extracting rather than copying is the point: two renderers would
 * drift, and the labels here are already the thing that stops an internal kind reaching a
 * learner's screen.
 */
/**
 * Learner-facing labels per Journey element kind (the content itself is Host-approved).
 *
 * EXHAUSTIVE by type (Slice 3.2M-1). It used to be `Record<string, …>` with a `?? el.kind`
 * fallback, and `follow_up` — added by Guided Authorship in 3.2L — had no entry, so a learner
 * would have been shown a section headed `follow_up`. The Host's own preview was typed against
 * the union and therefore could not drift; this one could, and did. Adding a future kind is now
 * a compile error here rather than an internal identifier on someone's screen.
 */
const JOURNEY_KIND_LABEL: Record<JourneyElementKind, { en: string; ko: string }> = {
  why_it_matters: { en: "WHY THIS MATTERS", ko: "왜 중요한가" },
  observable_standard: { en: "THE STANDARD", ko: "기준" },
  scenario: { en: "IN CONTEXT", ko: "상황" },
  reflection: { en: "REFLECT", ko: "성찰" },
  action_decision: { en: "YOUR DECISION", ko: "결정" },
  field_application: { en: "APPLY IT", ko: "적용" },
  evidence: { en: "WHAT SUCCESS LOOKS LIKE", ko: "성공의 모습" },
  completion_check: { en: "BEFORE YOU FINISH", ko: "마치기 전에" },
  follow_up: { en: "WHAT HAPPENS NEXT", ko: "다음에 일어날 일" },
};

/**
 * The learner's answer to the REFLECT question (Slice 3.2R-R8B).
 *
 * It lives HERE, beneath the question it answers, rather than on the completion surface. The
 * alternative — repeating the question further down next to a second box — is how a learner ends
 * up reading "What usually happens…" twice and answering it once, and the whole point of this
 * slice is that examining current practice and committing to a sentence are different acts with
 * different questions. One question, one control, in one place.
 */
export type ReflectionAnswer = {
  value: string;
  onChange: (next: string) => void;
  error: boolean;
  placeholder: string;
  errorText: string;
  disabled?: boolean;
};

export function JourneyReading({
  journey,
  locale,
  reflection,
}: {
  journey: Journey;
  locale: string;
  reflection?: ReflectionAnswer | null;
}) {
  if (!journey || journey.elements.length === 0) return null;
  const lang = locale === "ko" ? "ko" : "en";
  /*
    TWO KINDS ARE DELIVERED BY THEIR OWN CONTROLS, NOT BY THIS LIST (Slice C17A Single-Ask V1).
    `completion_check` was always excluded for that reason. `action_decision` joins it on the same
    reasoning, and on measured evidence.

    MEASURED on the Founder's own completed run (event `6b1ba8b5`, progress `c2e66f5e`): in the
    written-guidance and document rooms the reading list and the decision control sit in ONE
    return, so once the learner declared the guidance read, the byte-identical C17A sentence —
    "이것을 가장 먼저 해볼 상황은 언제인가요? 그때 무엇을 하겠어요?" — was on screen twice at once:
    here as a question with no way to answer it, and again above `decision-context` with the ask
    and the textarea. Only the second copy does anything.

    THE VIDEO ROOM IS UNAFFECTED, and that is why this belongs here rather than behind a
    room-specific prop: its watch and response stages are separate screens, so it never duplicated
    the sentence — and all three rooms read `action_decision` straight off the journey for their
    own `decision-context`, never from this list. No room can lose its only copy.
  */
  const blocks = journey.elements.filter((e) => e.kind !== "completion_check" && e.kind !== "action_decision");
  if (blocks.length === 0) return null;
  return (
    <section className="flex flex-col gap-4" data-testid="journey-reading">
      {blocks.map((el) => (
        <div key={el.id} className="flex flex-col gap-1" data-testid={`journey-el-${el.kind}`}>
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[#C9A66B]/85">
            {JOURNEY_KIND_LABEL[el.kind as JourneyElementKind][lang]}
          </span>
          <p className="text-base leading-7 text-white/85">{el.content}</p>
          {el.kind === "reflection" && reflection ? (
            <div className="mt-2 flex flex-col gap-1">
              <textarea
                data-testid="journey-reflection-input"
                value={reflection.value}
                onChange={(e) => reflection.onChange(e.target.value)}
                placeholder={reflection.placeholder}
                disabled={reflection.disabled}
                rows={3}
                maxLength={1000}
                className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-base leading-6 text-white/90 outline-none placeholder:text-white/30 focus:border-[#C9A66B]/50 disabled:opacity-50"
              />
              {reflection.error ? (
                <span className="text-xs text-red-300/90" data-testid="journey-reflection-error">
                  {reflection.errorText}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}
