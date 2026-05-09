/**
 * AL-2-B Phase 2 — Layer 2 (`bty_tension_axis` sentence) → Layer 1 (`AxisVector` key) mapping.
 *
 * Strategy C (Decision S):
 *   Primary  — 47-row authoritative enum table (Decision E lock, BTY Semantic Council 4-set).
 *   Fallback — 12-axis keyword cluster (Set 4 extension: optics/short-term/disclosure).
 *   Conservative ambiguity rule — 0 match → null; 1 match → axis; 2+ match → null + warn.
 *
 * Cascading policy: Option A (enum wins, narrative primary).
 *
 * Phase 2 scope: standalone capacity. No consumer in production code (Decision Cn).
 * Source of truth for enum entries: docs/AL-2-A-mapping-decision-template.csv.
 */
import type { AxisVector } from "./fingerprint";

const TENSION_AXIS_TO_AXIS_VECTOR: Record<string, keyof AxisVector | null> = {
  // ── HIGH (Type 1, single-side keyword match) — 27 entries ──
  "Audit Optics vs. Documentation Integrity": "integrity",
  "Blame Efficiency vs. System Accountability": "accountability",
  "Blame vs. Structural Honesty": "truth",
  "Chain of Command Loyalty vs. Patient Outcome Advocacy": "authority",
  "Clinical Standard vs. Scheduling Authority": "authority",
  "Collegial Protection vs. Operational Integrity": "integrity",
  "Compliance Conformity vs. Clinical Integrity": "integrity",
  "Cultural Drift vs. Core Integrity": "integrity",
  "Empathy Loyalty vs. Structural Authority": "authority",
  "Executive Compliance vs. Operational Truth-Telling": "truth",
  "Institutional Defense vs. Relational Honesty": "truth",
  "Institutional Loyalty vs. Integrity in Documentation": "integrity",
  "Job Security vs. Contractual Integrity": "integrity",
  "Metric Performance vs. Data Integrity": "integrity",
  "Operational Compliance vs. Patient Safety Integrity": "integrity",
  "Operational Inertia vs. Clinical Support Responsibility": "accountability",
  "Patient Access vs. Billing Integrity": "integrity",
  "Patient Autonomy vs. Retroactive Disclosure Risk": "courage",
  "Peer Loyalty vs. Clinical Honesty": "truth",
  "Performance Loyalty vs. Integrity Enforcement": "integrity",
  "Personal Gain vs. Clinical Accountability": "accountability",
  "Prior Knowledge vs. Complaint Integrity": "integrity",
  "Reporting Integrity vs. Political Safety": "integrity",
  "Short-Term Metric vs. Structural Integrity": "integrity",
  "Structural Self-Advocacy vs. Cultural Compliance": "identity",
  "Tenure Loyalty vs. System Integrity": "integrity",
  "Volume Compliance vs. Legal and Clinical Documentation Integrity": "integrity",

  // ── Set 2 lock (cross-axis decision, narrative primary) — 5 entries ──
  "Authority Avoidance vs. Leadership Integrity": "authority",
  "Clinical Integrity vs. Authority Compliance": "integrity",
  "Conflict Avoidance vs. Cultural Ownership": "conflict",
  "Hierarchical Compliance vs. Clinical Accountability": "accountability",
  "Structural Honesty vs. Face-Saving": "truth",

  // ── Set 1 lock (anchor lean) — 3 entries ──
  "Reputation Protection vs. Direct Alignment": "visibility",
  "Self-Protection vs. Clinical Ownership": "control",
  "Self-Protection vs. Institutional Courage": "control",

  // ── Type 4 (OUTSIDE, Path B explicit null) — 12 entries ──
  "Accidental Knowledge vs. Compliance Obligation": null,
  "Certainty Standard vs. Patient Safety Obligation": null,
  "Clinical Judgment vs. Patient Autonomy": null,
  "Comfort of Assumption vs. Informed Decision-Making": null,
  "Confidentiality Obligation vs. Staff Trust": null,
  "Institutional Compliance vs. Workforce Dignity": null,
  "Institutional Loyalty vs. Staff Equity Advocacy": null,
  "Operational Compliance vs. Clinical Excellence Defense": null,
  "Operational Pragmatism vs. Structural Clarity": null,
  "Peer Protection vs. Patient Advocacy": null,
  "Political Safety vs. Structural Fairness": null,
  "Population Equity vs. Metric Standardization": null,
};

const AXIS_KEYWORD_CLUSTER: Record<keyof AxisVector, readonly string[]> = {
  ownership: ["ownership", "escape", "evasion", "claim", "taking"],
  time: ["future", "deferral", "postpone", "urgency", "timing", "short-term"],
  authority: ["authority", "power", "hierarchy", "command", "leader"],
  truth: ["truth", "honesty", "transparency", "distort", "reality"],
  repair: ["repair", "mending", "restoration"],
  conflict: ["conflict", "confrontation", "delegation", "deflection"],
  integrity: ["integrity", "alignment", "principle", "congruence"],
  visibility: ["visibility", "reputation", "exposure", "face", "image", "optics", "disclosure"],
  accountability: ["accountability", "explanation", "responsibility"],
  courage: ["courage", "brave", "risk", "vulnerability"],
  control: ["control", "dominance", "fixation", "grip"],
  identity: ["identity", "self", "definition", "persona"],
};

function keywordFallback(literal: string): keyof AxisVector | null {
  const lc = literal.toLowerCase();
  const matches: Array<keyof AxisVector> = [];

  for (const [axis, keywords] of Object.entries(AXIS_KEYWORD_CLUSTER) as Array<
    [keyof AxisVector, readonly string[]]
  >) {
    if (keywords.some((kw) => lc.includes(kw))) {
      matches.push(axis);
    }
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  console.warn(
    `[tensionAxisToAxisVector] ambiguous literal: "${literal}" (matches: ${matches.join(", ")})`,
  );
  return null;
}

export function tensionAxisToAxisVector(
  literal: string | null | undefined,
): keyof AxisVector | null {
  if (literal == null || typeof literal !== "string") return null;
  const trimmed = literal.trim();
  if (trimmed === "") return null;

  if (Object.prototype.hasOwnProperty.call(TENSION_AXIS_TO_AXIS_VECTOR, trimmed)) {
    return TENSION_AXIS_TO_AXIS_VECTOR[trimmed];
  }

  return keywordFallback(trimmed);
}
