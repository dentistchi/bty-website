/**
 * Shared action-contract field checks (Arena Step 6 + chain workspace CLI).
 * Light, executable-commitment focused; neutral error copy. Field names unchanged for storage/QR.
 */

const TIME_ANCHOR_RE =
  /\b(\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|jan\.?|feb\.?|mar\.?|apr\.?|jun\.?|jul\.?|aug\.?|sep\.?|sept\.?|oct\.?|nov\.?|dec\.?)\b/i;

const CLOCK_OR_RELATIVE_RE =
  /\b(\d{1,2}:\d{2}|am\b|pm\b|a\.m\.|p\.m\.|o'clock|today|tomorrow|tonight|this week|next week|next month|in \d+ (minute|minutes|hour|hours|day|days|week|weeks))\b/i;

/** Distant calendar / non-committal phrases (not “later today”) */
const WHEN_DISTANT_RE = [
  /\bin\s+(a\s+)?year\b/i,
  /\bin\s+\d+\s*years?\b/i,
  /\bnext\s+year\b/i,
  /\bone\s+year\b/i,
  /\bmany\s+years\b/i,
  /\bwhen i get a chance\b/i,
  /\bin the near future\b/i,
];

const WHEN_STANDALONE_VAGUE_RE = /^(soon|someday|eventually)\.?$/i;
const WHEN_STANDALONE_LATER_RE = /^later\.?$/i;

function countLettersAndNumbers(s: string): number {
  const m = s.match(/[\p{L}\p{N}]/gu);
  return m ? m.length : 0;
}

function countLetters(s: string): number {
  const m = s.match(/[\p{L}]/gu);
  return m ? m.length : 0;
}

function hasTimeAnchor(when: string): boolean {
  return (
    TIME_ANCHOR_RE.test(when) || CLOCK_OR_RELATIVE_RE.test(when) || /\d/.test(when)
  );
}

/** Whole-line answers that avoid naming a person */
const WHO_GROUP_OR_VAGUE_RE =
  /^(the\s+)?(team|staff|everyone|everybody|people|all\s+staff|my\s+team|the\s+team|management|they|them)\.?$/i;

const WHO_GROUP_WORD_BOUNDARY_RE =
  /^(the\s+)?(team|staff|everyone|everybody)(\s+only)?\.?$/i;

export function validateContractWho(who: string): string | null {
  const t = who.trim();
  if (t.length === 0) return null;

  if (countLettersAndNumbers(t) < 2) {
    return "Add a real name or initials—something that identifies one person.";
  }
  if (WHO_GROUP_OR_VAGUE_RE.test(t) || WHO_GROUP_WORD_BOUNDARY_RE.test(t)) {
    return "Use one specific person’s name—not a group label like team or everyone.";
  }
  if (/\b(everyone|everybody|all staff|the team|my team)\b/i.test(t) && countLettersAndNumbers(t) < 12) {
    return "Name one person. If the team matters, still pick who you will speak with first.";
  }
  return null;
}

const WHAT_PERSON_LABEL_RE =
  /\b(she|he|they|you)\s+(is|are|'re)\s+(\w+\s+){0,2}?(difficult|toxic|wrong|bad|horrible|impossible|lazy|annoying|a\s+problem|the\s+problem)\b/i;

function whatWordTokens(t: string): string[] {
  return t
    .split(/\s+/)
    .map((w) => w.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ""))
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
}

export function validateContractWhat(what: string): string | null {
  const t = what.trim();
  if (t.length === 0) return null;

  if (t.length < 8) {
    return "Add a few more words about the situation you have been avoiding.";
  }
  if (countLetters(t) < 2) {
    return "Describe the situation using ordinary words, not only symbols.";
  }
  const tokens = whatWordTokens(t);
  if (tokens.length < 2) {
    return "Use at least two words about the situation—not a single label.";
  }
  if (WHAT_PERSON_LABEL_RE.test(t)) {
    return "Describe what happened or what is stuck—not a label about the person.";
  }
  return null;
}

export type WhenValidationFailure = { rule: "R3" | "R5"; message: string };

const vagueWhenMessage =
  "Pick a time close enough to act—today, tonight, tomorrow, or this week when you can.";

export function validateContractWhenDetailed(when: string): WhenValidationFailure | null {
  const t = when.trim();
  if (t.length === 0) return null;

  if (WHEN_STANDALONE_VAGUE_RE.test(t) || WHEN_STANDALONE_LATER_RE.test(t)) {
    return { rule: "R5", message: vagueWhenMessage };
  }
  if (
    /\blater\b/i.test(t) &&
    !/\b(today|tonight|tomorrow|this week|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      t,
    ) &&
    !/\d/.test(t)
  ) {
    return { rule: "R5", message: vagueWhenMessage };
  }
  if (/\bsoon\b/i.test(t) && !/\b(today|tonight|tomorrow|this week|next week)\b/i.test(t) && !/\d/.test(t)) {
    return { rule: "R5", message: vagueWhenMessage };
  }

  for (const re of WHEN_DISTANT_RE) {
    if (re.test(t)) {
      return { rule: "R5", message: vagueWhenMessage };
    }
  }

  if (!hasTimeAnchor(t)) {
    return {
      rule: "R3",
      message: "Add a day or clock time (for example Thursday 9am or today after standup).",
    };
  }

  return null;
}

/** @deprecated prefer validateContractWhenDetailed for UI rule mapping */
export function validateContractWhen(when: string): string | null {
  const d = validateContractWhenDetailed(when);
  return d ? d.message : null;
}

const HOW_ACCUSATION_START =
  /^\s*you\s+('?re|are|always|never|dont|don't|do\s+not|were|was)\b/i;

export function validateContractHow(how: string): string | null {
  const t = how.trim();
  if (t.length === 0) return null;

  if (t.length < 6) {
    return "Write a short first sentence you could actually say out loud.";
  }
  if (!/[\p{L}\p{N}]/u.test(t)) {
    return "Use words, not only punctuation.";
  }
  if (countLetters(t) < 2 && countLettersAndNumbers(t) < 4) {
    return "Add a readable sentence—start with what you want or what you own.";
  }
  const letters = countLetters(t);
  const punctOrSym = (t.match(/[\p{P}\p{S}]/gu) ?? []).length;
  if (letters > 0 && punctOrSym > letters * 4) {
    return "This looks mostly symbols. Write a plain first sentence.";
  }
  if (HOW_ACCUSATION_START.test(t)) {
    return "Start with honesty or responsibility—not “you are,” “you always,” or “you never.”";
  }
  return null;
}
