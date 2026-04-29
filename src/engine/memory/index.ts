/**
 * BTY Memory Engine — behavior memory events, pattern aggregation, trigger queue scaffold.
 */

export type {
  MemoryEventSource,
  MemoryTriggerType,
  MemoryTriggerStatus,
  MemoryPatternKey,
  ChoiceConfirmedMemoryPayload,
} from "@/engine/memory/memory-engine.types";

export { insertBehaviorMemoryEvent, type InsertMemoryEventInput } from "@/engine/memory/memory-record.service";
export { aggregateRepeatedFlagTypes } from "@/engine/memory/memory-pattern-aggregation.service";
export {
  enqueueMemoryTrigger,
  enqueuePatternThresholdIfEligible,
  type EnqueueMemoryTriggerInput,
} from "@/engine/memory/memory-trigger-queue.service";
export { recordChoiceConfirmedMemory } from "@/engine/memory/memory-integration.service";
export {
  consumePendingPatternThresholdRecall,
  buildRecallNarrative,
  derivePatternKeyForRecall,
} from "@/engine/memory/memory-recall-prompt.service";
