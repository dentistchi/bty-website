// IA-B4e-2: Growth UI removed. Only shared infra re-exported (seed pipe, my-page reflection/history, recovery gate).
export type { ReflectionFocus, ReflectionSeed } from "./buildReflectionSeed";
export { buildReflectionSeed } from "./buildReflectionSeed";
export type { ReflectionEntry } from "./types";
export {
  clearReflections,
  loadReflectionEntries,
  loadReflections,
  pushReflection,
  pushReflectionEntry,
  REFLECTION_STORAGE_KEY,
} from "./reflectionStorage";
export { computeGrowthHistory } from "./computeGrowthHistory";
export { checkArenaLowRegulation, checkRecoveryTrigger } from "./checkRecoveryTrigger";
export { shouldShowCompoundRecovery } from "./recoveryCompoundSignal";
export type { RecoveryEntry, RecoveryPrompt, RecoveryPromptReason } from "./recoveryTypes";
