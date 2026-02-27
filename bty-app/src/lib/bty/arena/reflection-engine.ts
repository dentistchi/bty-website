// reflectionEngine.ts
// Server-only module. Do not ship to client bundles.

export type LevelId = "S1" | "S2" | "S3" | "L1" | "L2" | "L3" | "L4";

export type PatternTag =
  | "defensive"
  | "blame"
  | "rushed"
  | "control"
  | "avoidant"
  | "people_blame"
  | "short_term"
  | "ego_threat";

export interface HumanModelLevel {
  stage_name: string;
  core_training_focus: string;
  primary_shift: string;
  risk_pattern: string[];
  maturity_marker: string;
  power_posture: string;
  reflection_bank: {
    baseline: string[];
    when_defensive: string[];
    when_blame: string[];
    when_rushed: string[];
    when_control: string[];
    when_avoidant: string[];
  };
}

export interface HumanModelConfig {
  version: string;
  notes?: string;
  tags: PatternTag[];
  levels: Record<LevelId, HumanModelLevel>;
}

export interface PatternDetection {
  tags: PatternTag[];
  scores: Record<PatternTag, number>;
  topTag?: PatternTag;
}

export interface ScenarioContext {
  scenarioId?: string;
  scenarioTitle?: string;
  situation?: string;
  userChoice?: string;
}

export interface ReflectionOutput {
  summary: string;
  questions: string[];
  next_action: string;
  detected: PatternDetection;
}

/**
 * Lightweight keyword/regex pattern detection (EN+KO).
 * No model calls. No scoring output shown to user (keep internal).
 */
export function detectPatterns(textRaw: string): PatternDetection {
  const text = (textRaw || "").toLowerCase();

  const scores: Record<PatternTag, number> = {
    defensive: 0,
    blame: 0,
    rushed: 0,
    control: 0,
    avoidant: 0,
    people_blame: 0,
    short_term: 0,
    ego_threat: 0
  };

  const bump = (tag: PatternTag, w: number) => (scores[tag] += w);

  // Helpers
  const has = (re: RegExp) => re.test(text);

  // Defensive
  if (has(/\b(not my fault|unfair|i had to|they always|i didn't|i did nothing)\b/)) bump("defensive", 3);
  if (has(/(억울|내 탓 아니|어쩔 수 없|난 잘했|왜 나만)/)) bump("defensive", 3);
  if (has(/\bbut\b/)) bump("defensive", 1);
  if (has(/근데|하지만/)) bump("defensive", 1);

  // Blame
  if (has(/\b(their fault|because of them|they messed up|they failed)\b/)) bump("blame", 3);
  if (has(/(쟤네 때문|그 사람이|저 사람이|걔가|저쪽이|탓이야|때문이야)/)) bump("blame", 3);

  // People-blame (more direct personal targeting)
  if (has(/\b(he is|she is|they are)\s+(lazy|stupid|incompetent)\b/)) bump("people_blame", 4);
  if (has(/(게으르|무능|답답|멍청|말이 안 통)/)) bump("people_blame", 4);

  // Rushed / urgency
  if (has(/\b(asap|immediately|right now|no time|urgent)\b/)) bump("rushed", 3);
  if (has(/(당장|지금 바로|빨리|급해|시간 없어|ASAP)/)) bump("rushed", 3);

  // Control language
  if (has(/\b(make them|force|must|zero tolerance|they have to)\b/)) bump("control", 3);
  if (has(/(무조건|반드시|시키|강제로|통제|제재|처벌)/)) bump("control", 3);

  // Avoidant
  if (has(/\b(ignore|avoid|let it go|hope it resolves|not my job)\b/)) bump("avoidant", 3);
  if (has(/(그냥 두|넘기|모른 척|피하|나중에|보기 싫|귀찮)/)) bump("avoidant", 3);

  // Short-term framing
  if (has(/\b(today|this week|quick win|right away)\b/)) bump("short_term", 2);
  if (has(/(이번 주|오늘만|당장 수치|빨리 결과|단기)/)) bump("short_term", 2);

  // Ego threat
  if (has(/\b(respect me|disrespect|they think i'm|look stupid|embarrassed)\b/)) bump("ego_threat", 3);
  if (has(/(무시|체면|자존심|망신|나를 어떻게 봐|존중 안 해)/)) bump("ego_threat", 3);

  // --- Domain: Dental ops + Philippines SSO (EN + KO) ---
  // Claims / RCM / Billing
  if (has(/\b(claim|claims|denial|denied|rejection|appeal|eob|ar|a\/r|aging|write[- ]?off|coding|cpt|icd)\b/)) bump("short_term", 1);
  if (has(/(클레임|디나이얼|거절|리젝|어필|EOB|AR|에이알|에이징|코딩|코드|CPT|ICD|write[- ]?off|라이트오프)/)) bump("short_term", 1);

  // Rework / redo / corrections -> often blame/control
  if (has(/\b(rework|redo|fix again|incorrect|wrong code|resubmit|re-submit|double work)\b/)) {
    bump("blame", 1);
    bump("control", 1);
  }
  if (has(/(리워크|리두|다시 해|재작업|수정|재제출|리서브밋|두번 일)/)) {
    bump("blame", 1);
    bump("control", 1);
  }

  // Turnaround / SLA pressure -> rushed
  if (has(/\b(turnaround|t\.?a\.?t\.?|sla|deadline|past due|overdue|backlog|queue)\b/)) bump("rushed", 2);
  if (has(/(턴어라운드|TAT|SLA|데드라인|마감|기한|오버듀|밀림|백로그|큐)/)) bump("rushed", 2);

  // Handoff / escalation / ownership -> people_blame/avoidant
  if (has(/\b(handoff|handover|ownership|who owns|escalate|escalation|ticket)\b/)) {
    bump("people_blame", 1);
    bump("avoidant", 1);
  }
  if (has(/(핸드오프|핸드오버|인수인계|오너십|누가 담당|에스컬|티켓)/)) {
    bump("people_blame", 1);
    bump("avoidant", 1);
  }

  // Charting / documentation / notes -> rushed
  if (has(/\b(charting|chart|clinical notes|documentation|tx plan|treatment plan)\b/)) bump("rushed", 1);
  if (has(/(차팅|차트|노트|기록|도큐먼트|Tx plan|치료계획|트리트먼트 플랜)/)) bump("rushed", 1);

  // Scheduling / no-show / overbook -> rushed/control
  if (has(/\b(schedule|scheduling|overbook|double-book|no[- ]?show|late cancel|fill the schedule)\b/)) {
    bump("rushed", 1);
    bump("control", 1);
  }
  if (has(/(스케줄|스케줄링|오버북|더블북|노쇼|지각취소|캔슬|스케줄 채우)/)) {
    bump("rushed", 1);
    bump("control", 1);
  }

  // Philippines SSO / offshore -> ego_threat
  if (has(/\b(philippines|manila|cebu|offshore|sso|shared services)\b/)) bump("ego_threat", 1);
  if (has(/(필리핀|마닐라|세부|오프쇼어|SSO|쉐어드 서비스)/)) bump("ego_threat", 1);

  // Escalation/friction with SSO -> defensive/blame
  if (has(/\b(they don't understand|communication issue|language barrier|timezone)\b/)) {
    bump("defensive", 2);
    bump("blame", 2);
  }
  if (has(/(말이 안 통|커뮤니케이션|언어 장벽|타임존|시차|이해 못)/)) {
    bump("defensive", 2);
    bump("blame", 2);
  }

  // Compliance / audit / HIPAA -> control
  if (has(/\b(compliance|audit|hipaa|phi|privacy breach|policy violation)\b/)) bump("control", 2);
  if (has(/(컴플라이언스|감사|HIPAA|PHI|개인정보|위반|정책 위반)/)) bump("control", 2);

  // Extract tags with score >= 3
  const tags = (Object.keys(scores) as PatternTag[]).filter((t) => scores[t] >= 3);

  // Choose top tag by highest score (tie-break by a priority order)
  // SSO/conflict: prefer order that best prevents escalation (people_blame → blame → control → defensive → …)
  const priority: PatternTag[] = ["people_blame", "blame", "control", "defensive", "rushed", "avoidant", "ego_threat", "short_term"];
  let topTag: PatternTag | undefined = undefined;

  const maxScore = Math.max(...(Object.values(scores) as number[]));
  if (maxScore > 0) {
    const candidates = (Object.keys(scores) as PatternTag[]).filter((t) => scores[t] === maxScore);
    topTag = priority.find((p) => candidates.includes(p)) || candidates[0];
  }

  return { tags, scores, topTag };
}

function pickN(arr: string[], n: number): string[] {
  const copy = [...arr];
  // deterministic-ish shuffle: rotate based on length to avoid randomness in tests
  const start = copy.length ? (copy.length % 3) : 0;
  const rotated = copy.slice(start).concat(copy.slice(0, start));
  return rotated.slice(0, Math.min(n, rotated.length));
}

function buildNextAction(levelId: LevelId, detectedTop?: PatternTag): string {
  // 24–72h action, aligned to level
  const top = detectedTop;

  switch (levelId) {
    case "S1":
      return "Within 24 hours: use a 30-second pause script once in a real interaction (breathe, name the emotion, state one factual sentence, ask one question).";
    case "S2":
      return "Within 72 hours: schedule one 1:1 conversation using the structure: Goal → Observation → Impact → Request (keep it respectful and specific).";
    case "S3":
      return "Within 72 hours: identify one recurring pattern and implement one process tweak (handoff checklist, role clarity, or a simple SOP) to prevent recurrence.";
    case "L1":
      return "Within 72 hours: reset one team norm in one sentence (calm tone, private correction, public encouragement) and model it in your next interaction.";
    case "L2":
      return "Within 72 hours: change one lever (role clarity, incentive, handoff, or governance rhythm) so the right behavior becomes the easiest behavior.";
    case "L3":
      return "Within 72 hours: write one principle sentence for this situation (non-negotiable + flexibility). Share it with leaders as direction, not pressure.";
    case "L4":
      // If control/ego threat shows up, nudge toward written memo and cooling period
      if (top === "control" || top === "ego_threat" || top === "rushed") {
        return "Within 72 hours: write a 1-page decision memo (trade-offs, risks, 5-year impact) and apply a 72-hour cooling period before final commitment.";
      }
      return "Within 72 hours: write a 1-page decision memo (trade-offs, risks, 5-year impact) and confirm one governance guardrail that protects the institution.";
  }
}

function buildSummary(userText: string, scenario?: ScenarioContext): string {
  const situation = scenario?.situation ? scenario.situation.trim() : "";
  const choice = scenario?.userChoice ? `Your stated direction/choice: ${scenario.userChoice.trim()}. ` : "";
  const user = (userText || "").trim();

  // Keep calm, factual, no judgment
  const s1 = situation
    ? `Situation noted: ${situation.slice(0, 220)}${situation.length > 220 ? "..." : ""}. `
    : "Situation noted. ";
  const s2 = user
    ? `You described: ${user.slice(0, 220)}${user.length > 220 ? "..." : ""}. `
    : "";
  const s3 = choice;

  return (s1 + s2 + s3).trim();
}

export function buildReflection(
  levelId: LevelId,
  userText: string,
  model: HumanModelConfig,
  scenario?: ScenarioContext
): ReflectionOutput {
  const detected = detectPatterns(userText);
  const level = model.levels[levelId];

  const baselineQs = pickN(level.reflection_bank.baseline, 2);

  let targeted: string[] = [];
  switch (detected.topTag) {
    case "defensive":
    case "ego_threat":
      targeted = pickN(level.reflection_bank.when_defensive, 1);
      break;
    case "blame":
    case "people_blame":
      targeted = pickN(level.reflection_bank.when_blame, 1);
      break;
    case "rushed":
    case "short_term":
      targeted = pickN(level.reflection_bank.when_rushed, 1);
      break;
    case "control":
      targeted = pickN(level.reflection_bank.when_control, 1);
      break;
    case "avoidant":
      targeted = pickN(level.reflection_bank.when_avoidant, 1);
      break;
    default:
      targeted = [];
  }

  const questions = targeted.length ? [...baselineQs, ...targeted] : pickN(level.reflection_bank.baseline, 3);
  const summary = buildSummary(userText, scenario);
  const next_action = buildNextAction(levelId, detected.topTag);

  return { summary, questions, next_action, detected };
}
