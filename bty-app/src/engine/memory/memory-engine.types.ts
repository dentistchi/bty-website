/**
 * BTY Memory Engine — types for events, pattern state, recall, trigger queue.
 */

export type MemoryEventSource = "arena_choice_confirmed";

export type MemoryTriggerType =
  | "delayed_outcome"
  | "perspective_switch"
  | "recall_prompt"
  | "memory_pattern_threshold";

export type MemoryTriggerStatus = "pending" | "processing" | "processed" | "cancelled" | "failed";

export type MemoryPatternKey =
  | `flag_total:${string}`
  | `flag_consecutive:${string}`;

export type ChoiceConfirmedMemoryPayload = {
  scenarioId: string;
  choiceId: string;
  flagType: string;
  playedAt: Date;
};
