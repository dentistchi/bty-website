/**
 * VALIDATOR_ARCHITECTURE_V1 §3.2 — server-side pattern family context (canonical texts).
 * Aligned to `PATTERN_ACTION_MODEL_V1.md` §2 family ids in `domain/pattern-family`.
 */
import type { PatternContextForModel } from "./types";
import { isCanonicalPatternFamily } from "@/domain/pattern-family";

const REGISTRY: Record<string, Omit<PatternContextForModel, "pattern_family">> = {
  ownership_escape: {
    avoided_reality:
      "Facing full ownership of outcomes, trade-offs, and consequences instead of partial claim or distancing.",
    re_entry_direction:
      "Move toward explicit ownership of decisions and their effects on others and the system.",
  },
  repair_avoidance: {
    avoided_reality:
      "Engaging in timely, direct repair after rupture instead of delaying or outsourcing reconciliation.",
    re_entry_direction:
      "Move toward timely contact, clarity, and repair behaviors rather than indefinite deferral.",
  },
  explanation_substitution: {
    avoided_reality:
      "Substituting narrative or justification for contact with the avoided interpersonal or operational reality.",
    re_entry_direction:
      "Move from explanation toward concrete external engagement with the situation or person.",
  },
  delegation_deflection: {
    avoided_reality:
      "Shifting responsibility or agency so the core tension with the avoided reality is not directly engaged.",
    re_entry_direction:
      "Move toward direct appropriate action or conversation rather than deflection through roles or proxies.",
  },
  future_deferral: {
    avoided_reality:
      "Deferring commitment into an unspecified future so the present avoided reality stays untouched.",
    re_entry_direction:
      "Move toward time-bounded, concrete external steps rather than vague postponement.",
  },
};

const GENERIC = {
  avoided_reality:
    "The scenario-specific reality the pattern avoids; use only the authored contract text for detail.",
  re_entry_direction:
    "Movement toward measurable external engagement with that reality rather than avoidance or substitution.",
};

/**
 * Context embedded in the semantic model prompt. No user ids, emails, or snapshot payloads.
 */
export function getPatternContextForModel(patternFamily: string | null | undefined): PatternContextForModel {
  const id = typeof patternFamily === "string" ? patternFamily.trim() : "";
  if (id && isCanonicalPatternFamily(id) && REGISTRY[id]) {
    return {
      pattern_family: id,
      avoided_reality: REGISTRY[id].avoided_reality,
      re_entry_direction: REGISTRY[id].re_entry_direction,
    };
  }
  return {
    pattern_family: id || "unspecified",
    avoided_reality: GENERIC.avoided_reality,
    re_entry_direction: GENERIC.re_entry_direction,
  };
}
