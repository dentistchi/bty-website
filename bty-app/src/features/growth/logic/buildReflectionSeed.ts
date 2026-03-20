import type { ArenaSignal } from "@/features/my-page/logic/types";

export type ReflectionFocus = "clarity" | "trust" | "regulation" | "alignment";

export type ReflectionSeed = {
  source: "arena";
  /** Set when the seed row comes from Supabase (`bty_reflection_seeds`). */
  id?: string;
  scenarioId: string;
  primary: string;
  reinforcement: string;
  focus: ReflectionFocus;
  promptTitle: string;
  promptBody: string;
  cue: string;
  createdAt: number;
};

/**
 * Translate a sealed Arena decision into an operational reflection unit (no raw score dump).
 */
export function buildReflectionSeed(signal: ArenaSignal): ReflectionSeed {
  const { primary, reinforcement, meta, scenarioId } = signal;

  if (primary === "A" && reinforcement === "X") {
    return {
      source: "arena",
      scenarioId,
      primary,
      reinforcement,
      focus: "clarity",
      promptTitle: "Protect trust without losing explanation clarity.",
      promptBody:
        "You stabilized trust before defending policy. What exact language would restore clarity without sounding defensive?",
      cue: "Reinforce explanation precision under relational pressure.",
      createdAt: Date.now(),
    };
  }

  if (primary === "B" && reinforcement === "Y") {
    return {
      source: "arena",
      scenarioId,
      primary,
      reinforcement,
      focus: "trust",
      promptTitle: "Preserve structure without shrinking trust.",
      promptBody:
        "You protected consistency under pressure. Where could the patient still feel unheard?",
      cue: "Expand empathy without weakening boundaries.",
      createdAt: Date.now(),
    };
  }

  if (meta.emotionalRegulation < 0.5) {
    return {
      source: "arena",
      scenarioId,
      primary,
      reinforcement,
      focus: "regulation",
      promptTitle: "Slow the internal reaction before the next decision cycle.",
      promptBody:
        "Your pattern suggests pressure absorption is incomplete. What sign would tell you to pause before responding?",
      cue: "Build regulation before escalation.",
      createdAt: Date.now(),
    };
  }

  return {
    source: "arena",
    scenarioId,
    primary,
    reinforcement,
    focus: "alignment",
    promptTitle: "Tighten alignment between intention and execution.",
    promptBody:
      "Your decision pattern is stable. Where can intent and delivery become more consistent?",
    cue: "Consolidate pattern into repeatable leadership behavior.",
    createdAt: Date.now(),
  };
}
