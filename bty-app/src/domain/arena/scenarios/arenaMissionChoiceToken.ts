/**
 * Mission Play → Resolve: primary (A|B|C) and reinforcement (X|Y) token checks.
 * Case-sensitive after trim; prototype scenario contract only.
 */

export function isArenaPrimaryMissionChoiceId(id: unknown): boolean {
  if (typeof id !== "string") return false;
  const s = id.trim();
  return s === "A" || s === "B" || s === "C";
}

export function isArenaReinforcementMissionChoiceId(id: unknown): boolean {
  if (typeof id !== "string") return false;
  const s = id.trim();
  return s === "X" || s === "Y";
}
