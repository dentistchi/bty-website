import type { ScenarioDifficulty } from "./types";

/**
 * Maps free-form strings (e.g. JSON/meta) to `ArenaScenario` difficulty union.
 * Trims; accepts canonical **`Low` \| `Moderate` \| `High`** or case-insensitive ASCII forms only.
 * Non-strings (including top-level **`Symbol`** / **`bigint`**) → **`null`**.
 */
export function arenaScenarioDifficultyFromUnknown(raw: unknown): ScenarioDifficulty | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t === "Low" || t === "Moderate" || t === "High") return t;
  const lower = t.toLowerCase();
  if (lower === "low") return "Low";
  if (lower === "moderate") return "Moderate";
  if (lower === "high") return "High";
  return null;
}
