/**
 * Foundry Guided Arena Builder — guided-question logic (pure).
 *
 * Decides WHICH suggestions to offer, grounded in the source module. Returns
 * option/seed KEYS only — the UI maps keys to localized copy (display strings
 * never live in domain). Deterministic; no DB, no I/O, no providers.
 */

import type { ModuleSnapshot } from "../module/module-publish";
import { normalizeLearningNeeds, type LearningNeed } from "../module/module-builder";
import {
  AVOIDANCE_PRESSURE_SEEDS,
  HARDEST_WHEN_OPTIONS,
  type AvoidancePressureSeed,
  type HardestWhenOption,
} from "./types";

/** Q1 options are a fixed set (no derivation) — exposed for the UI to localize. */
export function hardestWhenOptions(): readonly HardestWhenOption[] {
  return HARDEST_WHEN_OPTIONS;
}

/**
 * Which avoidance-pressure seeds are most relevant, ordered, for this module.
 * Deterministic bias by learning need: a shared-standard / decision need pulls
 * authority + credibility forward; a practice need pulls credibility + safety;
 * a "know"-only module keeps the neutral base order. Every seed is always
 * returned (the host can pick any or write their own) — only the ORDER changes.
 */
export function deriveAvoidanceSeeds(snapshot: ModuleSnapshot | undefined): AvoidancePressureSeed[] {
  const needs = normalizeLearningNeeds(snapshot);
  const priority: AvoidancePressureSeed[] = [];
  const push = (s: AvoidancePressureSeed) => {
    if (!priority.includes(s)) priority.push(s);
  };

  const has = (n: LearningNeed) => needs.includes(n);
  if (has("shared_standard")) {
    push("authority");
    push("credibility");
  }
  if (has("decide")) {
    push("time");
    push("cost");
  }
  if (has("practice")) {
    push("credibility");
    push("safety");
  }

  // Append the remaining seeds in the canonical base order (stable, exhaustive).
  for (const s of AVOIDANCE_PRESSURE_SEEDS) push(s);
  return priority;
}
