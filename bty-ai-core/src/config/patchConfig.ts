/**
 * Runtime patch config loader.
 * Loads latest patch config from DB (applied) or from local /patches folder (dev).
 * Merges into base config for: banned_phrases, selfCritic_rules, rewrite_constraints, thresholds.
 */

import * as fs from "fs";
import * as path from "path";
import { getPool } from "./database";

export type PatchConfigOverrides = {
  banned_phrases?: string[];
  selfCritic_rules?: {
    false_persona_patterns?: string[];
    false_persona_replacement?: string;
    dependency_risk_patterns?: string[];
  };
  rewrite_constraints?: {
    max_sentences?: number;
    max_questions?: number;
  };
  thresholds?: {
    max_sentences?: number;
    max_questions?: number;
    max_chars?: number;
    context_drift_overlap?: number;
  };
};

const BASE_BANNED_PHRASES = [
  "가장 도전적으로",
  "방향성",
  "구체적으로 생각해",
  "어떤 감정인지",
  "조금 더 들어볼까요",
  "어떻게 해석",
  "통제할 수 있는 부분",
];

const BASE_FALSE_PERSONA_SOURCES = [
  String.raw`제\s*경험`,
  String.raw`제가\s+겪어본`,
  String.raw`기억에\s+남는`,
  String.raw`나도\s+[^.!?\n]*?했어`,
  String.raw`나\s*는\s+[^.!?\n]*?해봤어`,
  String.raw`내\s*경험`,
  String.raw`나도\s+`,
  String.raw`나\s+역시`,
  String.raw`내가\s+겪었`,
  String.raw`저도\s+했`,
  String.raw`제가\s+했`,
  String.raw`나\s+같이`,
  String.raw`저\s+같이`,
];

const BASE_DEPENDENCY_RISK_SOURCES = [
  String.raw`나만\s*믿어`,
  String.raw`나한테\s*맡겨`,
  String.raw`여기서\s*항상\s*있을게`,
  String.raw`언제나\s*여기\s*있을게`,
  String.raw`당신만의\s*편`,
  String.raw`함께\s*있을게요`,
  String.raw`영원히\s*함께`,
  String.raw`내가\s*지켜줄게`,
  String.raw`혼자가\s*아니에요`,
  String.raw`나\s*있잖아`,
  String.raw`오직\s*나만`,
];

const BASE_FALSE_PERSONA_REPLACEMENT = "리더 입장에서 함께 정리해볼게요.";

const BASE_THRESHOLDS = {
  max_sentences: 3,
  max_questions: 1,
  max_chars: 280,
  context_drift_overlap: 0.2,
};

let cachedOverrides: PatchConfigOverrides | null = null;

function compileRegexList(sources: string[]): RegExp[] {
  return sources.map((s) => {
    try {
      return new RegExp(s);
    } catch {
      return new RegExp("^$"); // no-match fallback
    }
  });
}

/**
 * Load config overrides from local /patches folder (dev only).
 * Looks for patches/applied.json or patches/latest.json.
 */
function loadFromPatchesFolder(): PatchConfigOverrides | null {
  if (process.env.NODE_ENV !== "development") return null;
  const patchesDir = path.join(process.cwd(), "patches");
  const candidates = ["applied.json", "latest.json"];
  for (const name of candidates) {
    const filePath = path.join(patchesDir, name);
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(raw) as PatchConfigOverrides;
      }
    } catch (e) {
      console.warn("[patchConfig] Failed to load", filePath, (e as Error).message);
    }
  }
  return null;
}

/**
 * Load config overrides from DB (latest applied patch).
 * Expects suggestions.config_overrides in the patch JSON.
 */
async function loadFromDb(): Promise<PatchConfigOverrides | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const r = await pool.query(
      `SELECT suggestions FROM bty_patch_suggestions
       WHERE status = 'applied' ORDER BY applied_at DESC NULLS LAST, created_at DESC LIMIT 1`
    );
    const row = r.rows[0];
    if (!row) return null;
    const sugs = typeof row.suggestions === "object"
      ? row.suggestions
      : JSON.parse(row.suggestions || "{}");
    return (sugs.config_overrides ?? null) as PatchConfigOverrides | null;
  } catch (e) {
    console.warn("[patchConfig] Failed to load from DB:", (e as Error).message);
    return null;
  }
}

/**
 * Load and cache config overrides. Call at startup or after apply.
 */
export async function reloadPatchConfig(): Promise<void> {
  const fromFile = loadFromPatchesFolder();
  if (fromFile) {
    cachedOverrides = fromFile;
    return;
  }
  cachedOverrides = await loadFromDb();
}

function merge<T>(base: T, over?: Partial<T>): T {
  if (!over) return base;
  return { ...base, ...over } as T;
}

// --- Getters (use cached or base) ---

export function getBannedPhrases(): string[] {
  const over = cachedOverrides?.banned_phrases;
  if (over && Array.isArray(over)) return [...BASE_BANNED_PHRASES, ...over];
  return [...BASE_BANNED_PHRASES];
}

export function getFalsePersonaPatterns(): RegExp[] {
  const over = cachedOverrides?.selfCritic_rules?.false_persona_patterns;
  const sources = over && Array.isArray(over)
    ? [...BASE_FALSE_PERSONA_SOURCES, ...over]
    : BASE_FALSE_PERSONA_SOURCES;
  return compileRegexList(sources);
}

export function getFalsePersonaReplacement(): string {
  return cachedOverrides?.selfCritic_rules?.false_persona_replacement ?? BASE_FALSE_PERSONA_REPLACEMENT;
}

export function getDependencyRiskPatterns(): RegExp[] {
  const over = cachedOverrides?.selfCritic_rules?.dependency_risk_patterns;
  const sources = over && Array.isArray(over)
    ? [...BASE_DEPENDENCY_RISK_SOURCES, ...over]
    : BASE_DEPENDENCY_RISK_SOURCES;
  return compileRegexList(sources);
}

export function getRewriteConstraints(): {
  max_sentences: number;
  max_questions: number;
} {
  const base = {
    max_sentences: BASE_THRESHOLDS.max_sentences,
    max_questions: BASE_THRESHOLDS.max_questions,
  };
  return merge(base, cachedOverrides?.rewrite_constraints);
}

export function getThresholds(): {
  max_sentences: number;
  max_questions: number;
  max_chars: number;
  context_drift_overlap: number;
} {
  return merge(BASE_THRESHOLDS, cachedOverrides?.thresholds);
}

export function getFullConfig(): {
  banned_phrases: string[];
  selfCritic_rules: {
    false_persona_patterns: RegExp[];
    false_persona_replacement: string;
    dependency_risk_patterns: RegExp[];
  };
  rewrite_constraints: ReturnType<typeof getRewriteConstraints>;
  thresholds: ReturnType<typeof getThresholds>;
} {
  return {
    banned_phrases: getBannedPhrases(),
    selfCritic_rules: {
      false_persona_patterns: getFalsePersonaPatterns(),
      false_persona_replacement: getFalsePersonaReplacement(),
      dependency_risk_patterns: getDependencyRiskPatterns(),
    },
    rewrite_constraints: getRewriteConstraints(),
    thresholds: getThresholds(),
  };
}
