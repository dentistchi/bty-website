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

export function JourneyReading({ journey, locale }: { journey: Journey; locale: string }) {
  if (!journey || journey.elements.length === 0) return null;
  const lang = locale === "ko" ? "ko" : "en";
  // The completion_check is delivered by the existing completion step, not the reading list.
  const blocks = journey.elements.filter((e) => e.kind !== "completion_check");
  if (blocks.length === 0) return null;
  return (
    <section className="flex flex-col gap-4" data-testid="journey-reading">
      {blocks.map((el) => (
        <div key={el.id} className="flex flex-col gap-1" data-testid={`journey-el-${el.kind}`}>
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[#C9A66B]/85">
            {JOURNEY_KIND_LABEL[el.kind as JourneyElementKind][lang]}
          </span>
          <p className="text-base leading-7 text-white/85">{el.content}</p>
        </div>
      ))}
    </section>
  );
}
