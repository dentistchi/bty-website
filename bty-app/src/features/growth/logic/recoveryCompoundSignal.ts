// IA-B4d PRESERVE: shared recovery gate infra used by My Page.
// Do not delete during Growth UI removal.
import type { ArenaSignal } from "@/features/my-page/logic/types";
import { checkRecoveryTrigger } from "./checkRecoveryTrigger";
import type { ReflectionEntry } from "./types";

/**
 * Recovery-oriented UI signal: Arena pressure and/or repeated regulation reflections.
 */
export function shouldShowCompoundRecovery(
  signals: ArenaSignal[],
  reflections: ReflectionEntry[],
): boolean {
  return checkRecoveryTrigger(signals, reflections);
}
