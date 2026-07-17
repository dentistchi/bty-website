/**
 * Foundry Guided Arena Builder — publish domain (pure).
 *
 * The deterministic, server-authoritative gate that decides whether a saved draft
 * may become an IMMUTABLE published practice. Reuses the Slice-3.0A structural
 * validator (the single source of truth for three-phase validity) and freezes a
 * normalized snapshot. No DB, no I/O, no providers, no display strings.
 *
 * Revision/lineage/idempotency are DB concerns (service layer); this only answers
 * "is this scenario structurally publishable, and what exact bytes get frozen?".
 */

import { parseArenaScenarioDraft } from "./validate";
import type { ArenaScenarioDraft } from "./types";

export type PublishableResult =
  | { ok: true; snapshot: ArenaScenarioDraft; warnings: string[] }
  | { ok: false; errors: string[] };

/**
 * Validate + normalize a scenario for publication. A null/malformed scenario is
 * rejected with the failing codes (never published as valid). On success returns
 * the normalized snapshot (trimmed strings, projected choice fields) — the exact
 * immutable bytes to freeze — plus any advisory warnings (sensitive info).
 */
export function publishableSnapshot(scenarioDraft: unknown): PublishableResult {
  if (scenarioDraft == null) return { ok: false, errors: ["no_scenario_to_publish"] };
  const parsed = parseArenaScenarioDraft(scenarioDraft);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  return { ok: true, snapshot: parsed.value, warnings: parsed.warnings };
}
