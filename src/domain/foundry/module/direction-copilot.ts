/**
 * Intent-to-Module Direction Copilot — domain (pure, Slice 2.4A).
 *
 * The AI proposes; THIS validator decides validity, fail-closed. It never calls a
 * model, never does I/O. Given the raw parsed provider JSON it returns either three
 * normalized, client-safe suggestions or a stable reject code. There is NO partial
 * success and NO deterministic fabrication: if the output is not three distinct,
 * observable, honest directions, the whole batch is rejected and the manual Builder
 * path stays available (see service/route).
 *
 * These are deliberately lexical, conservative gates — a minimum floor, not a claim
 * of semantic perfection. The generation instruction (service) carries the meaning;
 * this layer stops the clearly-bad shapes from ever reaching the Host.
 *
 * No DB, no I/O, no providers.
 */

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const DIRECTION_COUNT = 3;
export const DIRECTION_GENERATION_VERSION = "direction_copilot_v1";

/** Conservative upper bounds sized to the results/review UI capacity. */
export const DIRECTION_LIMITS = {
  title: 80,
  capability_candidate: 80,
  rationale: 320,
  observable_behavior: 320,
  success_evidence_hint: 320,
  important_assumption: 240,
} as const;

/** A single validated, Host-visible direction. `id` is assigned server-side. */
export type DirectionSuggestion = {
  id: string;
  title: string;
  capability_candidate: string;
  rationale: string;
  observable_behavior: string;
  success_evidence_hint: string;
  /** Optional — null when the model offered no explicit assumption. */
  important_assumption: string | null;
};

/** Stable reject codes (server maps to a generic Host error; never leaked verbatim). */
export type DirectionRejectCode =
  | "not_object"
  | "not_array"
  | "wrong_count"
  | "item_not_object"
  | "missing_field"
  | "field_not_string"
  | "empty_field"
  | "too_long"
  | "unsafe_markup"
  | "duplicate_capability"
  | "duplicate_title"
  | "duplicate_behavior"
  | "vague_behavior"
  | "overclaiming_evidence";

export type DirectionValidation =
  | { ok: true; suggestions: DirectionSuggestion[] }
  | { ok: false; code: DirectionRejectCode };

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Collapse runs of whitespace (incl. newlines) to single spaces and trim edges. */
function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Lexical distinctness key: lowercase, drop non-alphanumerics, collapse spaces. */
function distinctKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Generic modifiers that must not, by themselves, make two titles "different". */
const GENERIC_TITLE_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "for", "in", "on",
  "better", "improved", "improve", "new", "clear", "clearer", "good", "great",
  "effective", "approach", "direction", "training", "option", "plan", "way",
  "how", "process", "method", "strategy", "focus", "on",
]);

function titleDistinctKey(s: string): string {
  return distinctKey(s)
    .split(" ")
    .filter((w) => w && !GENERIC_TITLE_WORDS.has(w))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Unsafe-markup gate
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const HTML_TAG = /<[^>]+>/;
const MARKDOWN_FENCE = /```|~~~/;
const DATA_URL = /data:\s*[\w.+-]+\/[\w.+-]+/i;
const SCRIPT_LIKE = /<\s*script|javascript:|onerror\s*=|onload\s*=/i;
/** A field whose whole value is itself serialized JSON (nested-JSON-as-text). */
const NESTED_JSON = /^\s*[[{][\s\S]*[\]}]\s*$/;

function hasUnsafeMarkup(raw: string): boolean {
  if (CONTROL_CHARS.test(raw)) return true;
  if (HTML_TAG.test(raw)) return true;
  if (MARKDOWN_FENCE.test(raw)) return true;
  if (DATA_URL.test(raw)) return true;
  if (SCRIPT_LIKE.test(raw)) return true;
  if (NESTED_JSON.test(raw)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Observability gate — a behavior must describe an act that could be observed.
// ---------------------------------------------------------------------------

/** Verbs/phrases that denote a visible, hearable, or recordable act. */
const OBSERVABLE_ACT = new RegExp(
  [
    "record", "records", "recorded", "write", "writes", "log", "logs", "logged",
    "note", "notes", "document", "documents", "say", "says", "state", "states",
    "repeat", "repeats", "read back", "confirm", "confirms", "ask", "asks",
    "name", "names", "list", "lists", "mark", "marks", "sign", "signs",
    "report", "reports", "hand off", "hands off", "check", "checks",
    "review", "reviews", "submit", "submits", "send", "sends", "assign", "assigns",
    "schedule", "schedules", "call", "calls", "flag", "flags", "escalate", "escalates",
    // Korean observable acts (locale ko)
    "기록", "적", "작성", "말", "확인", "복창", "질문", "서명", "보고", "점검", "제출", "표시",
  ].join("|"),
  "i",
);

/** Vague stems that, standing alone, are goals rather than observable acts. */
const VAGUE_STEM = new RegExp(
  [
    "^improve\\b", "^be more\\b", "^become more\\b", "^understand\\b",
    "^increase\\b", "^raise\\b", "^enhance\\b", "^foster\\b", "^promote\\b",
    "^ensure better\\b", "^have (a )?better\\b", "^feel\\b", "^know the importance\\b",
    "^care more\\b", "^take (more )?responsibility\\b", "^be aware\\b", "^gain awareness\\b",
  ].join("|"),
  "i",
);

/** Reject when the behavior is a bare abstract goal with no observable act. */
function isVagueBehavior(normalized: string): boolean {
  const startsVague = VAGUE_STEM.test(normalized);
  const hasObservable = OBSERVABLE_ACT.test(normalized);
  return startsVague && !hasObservable;
}

// ---------------------------------------------------------------------------
// Evidence-honesty gate — evidence of the ACT, not proof of permanent change.
// ---------------------------------------------------------------------------

const OVERCLAIM = new RegExp(
  [
    "now competent", "fully (understand|understood|understands)", "permanently",
    "behaviou?r (has )?(permanently )?changed", "trust (was|is|has been) restored",
    "mastered", "no longer needs?", "will always", "forever", "completely (understand|changed)",
    "internaliz", "truly cares?", "has become", "culture (has )?changed",
  ].join("|"),
  "i",
);

function isOverclaimingEvidence(raw: string): boolean {
  return OVERCLAIM.test(raw);
}

// ---------------------------------------------------------------------------
// Field-level normalize + bound
// ---------------------------------------------------------------------------

type RequiredKey =
  | "title"
  | "capability_candidate"
  | "rationale"
  | "observable_behavior"
  | "success_evidence_hint";

const REQUIRED_KEYS: readonly RequiredKey[] = [
  "title",
  "capability_candidate",
  "rationale",
  "observable_behavior",
  "success_evidence_hint",
];

/**
 * Whether a generation request's problem statement is compatible with the problem
 * saved on the draft (stale-result guard, §9). Tolerant of trivial whitespace/case
 * differences; a real edit diverges and the server rejects the request as stale.
 */
export function problemStatementsCompatible(a: string, b: string): boolean {
  return normalizeWhitespace(a).toLowerCase() === normalizeWhitespace(b).toLowerCase();
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate raw parsed provider output (`{ suggestions: [...] }` OR a bare array).
 * Fail-closed: any structural, safety, distinctness, observability, or honesty
 * failure rejects the WHOLE batch. On success returns exactly three normalized
 * suggestions with server-assigned ids (`direction_1..3`); unknown item fields are
 * dropped; `important_assumption` normalizes absent/blank → null.
 */
export function validateDirectionSuggestions(raw: unknown): DirectionValidation {
  const arr: unknown = isPlainObject(raw)
    ? (raw as Record<string, unknown>).suggestions
    : raw;

  if (!isPlainObject(raw) && !Array.isArray(raw)) return { ok: false, code: "not_object" };
  if (!Array.isArray(arr)) return { ok: false, code: "not_array" };
  if (arr.length !== DIRECTION_COUNT) return { ok: false, code: "wrong_count" };

  const out: DirectionSuggestion[] = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (!isPlainObject(item)) return { ok: false, code: "item_not_object" };

    const fields: Record<RequiredKey, string> = {
      title: "",
      capability_candidate: "",
      rationale: "",
      observable_behavior: "",
      success_evidence_hint: "",
    };

    for (const key of REQUIRED_KEYS) {
      const v = item[key];
      if (v === undefined || v === null) return { ok: false, code: "missing_field" };
      if (typeof v !== "string") return { ok: false, code: "field_not_string" };
      const norm = normalizeWhitespace(v);
      if (norm.length === 0) return { ok: false, code: "empty_field" };
      if (hasUnsafeMarkup(v) || hasUnsafeMarkup(norm)) return { ok: false, code: "unsafe_markup" };
      if (norm.length > DIRECTION_LIMITS[key]) return { ok: false, code: "too_long" };
      fields[key] = norm;
    }

    // Optional assumption: absent/null/blank → null; present must be a safe, bounded string.
    let assumption: string | null = null;
    const rawAssumption = item.important_assumption;
    if (rawAssumption !== undefined && rawAssumption !== null) {
      if (typeof rawAssumption !== "string") return { ok: false, code: "field_not_string" };
      const normA = normalizeWhitespace(rawAssumption);
      if (normA.length > 0) {
        if (hasUnsafeMarkup(rawAssumption) || hasUnsafeMarkup(normA)) return { ok: false, code: "unsafe_markup" };
        if (normA.length > DIRECTION_LIMITS.important_assumption) return { ok: false, code: "too_long" };
        assumption = normA;
      }
    }

    if (isVagueBehavior(distinctKey(fields.observable_behavior))) {
      return { ok: false, code: "vague_behavior" };
    }
    if (isOverclaimingEvidence(fields.success_evidence_hint)) {
      return { ok: false, code: "overclaiming_evidence" };
    }

    out.push({
      id: `direction_${i + 1}`,
      title: fields.title,
      capability_candidate: fields.capability_candidate,
      rationale: fields.rationale,
      observable_behavior: fields.observable_behavior,
      success_evidence_hint: fields.success_evidence_hint,
      important_assumption: assumption,
    });
  }

  // Distinctness — the three directions must not be trivial paraphrases.
  const capKeys = out.map((s) => distinctKey(s.capability_candidate));
  if (new Set(capKeys).size !== DIRECTION_COUNT) return { ok: false, code: "duplicate_capability" };

  const titleKeys = out.map((s) => titleDistinctKey(s.title));
  if (new Set(titleKeys.filter((k) => k.length > 0)).size !== titleKeys.length) {
    return { ok: false, code: "duplicate_title" };
  }

  const behaviorKeys = out.map((s) => distinctKey(s.observable_behavior));
  if (new Set(behaviorKeys).size !== DIRECTION_COUNT) return { ok: false, code: "duplicate_behavior" };
  // A behavior that is merely a shorter version of another (substring containment).
  for (let a = 0; a < behaviorKeys.length; a++) {
    for (let b = 0; b < behaviorKeys.length; b++) {
      if (a === b) continue;
      if (behaviorKeys[a].length > 0 && behaviorKeys[b].includes(behaviorKeys[a])) {
        return { ok: false, code: "duplicate_behavior" };
      }
    }
  }

  return { ok: true, suggestions: out };
}
