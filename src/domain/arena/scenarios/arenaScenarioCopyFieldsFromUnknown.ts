/**
 * Parses lobby/header copy fields for `ArenaScenario` from untrusted JSON:
 * **stage**, **caseTag**, **title** — trimmed non-empty strings with length caps.
 * (Does not validate `id`, `difficulty`, choices, or `outcomes`; use sibling `*FromUnknown` helpers.)
 */

export const ARENA_SCENARIO_STAGE_MAX_LENGTH = 128;
export const ARENA_SCENARIO_CASE_TAG_MAX_LENGTH = 128;
export const ARENA_SCENARIO_TITLE_MAX_LENGTH = 300;

export type ArenaScenarioCopyFields = {
  stage: string;
  caseTag: string;
  title: string;
};

function boundedTrimmedString(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > max) return null;
  return s;
}

export function arenaScenarioCopyFieldsFromUnknown(value: unknown): ArenaScenarioCopyFields | null {
  if (value == null || typeof value === "bigint" || typeof value === "symbol") return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const stage = boundedTrimmedString(o.stage, ARENA_SCENARIO_STAGE_MAX_LENGTH);
  const caseTag = boundedTrimmedString(o.caseTag, ARENA_SCENARIO_CASE_TAG_MAX_LENGTH);
  const title = boundedTrimmedString(o.title, ARENA_SCENARIO_TITLE_MAX_LENGTH);
  if (stage === null || caseTag === null || title === null) return null;
  return { stage, caseTag, title };
}
