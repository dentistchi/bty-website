/**
 * Foundry skill micro-assessments (6 bilingual packs). Assignment uses weakest `flag_type` coverage
 * from {@link getScenarioStats}; persistence in `user_dojo_attempts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getScenarioStats, type ScenarioStats } from "@/engine/scenario/scenario-stats.service";
import type { ScenarioLocalePreference } from "@/engine/scenario/scenario-selector.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export type DojoSkillArea =
  | "communication"
  | "decision"
  | "resilience"
  | "integrity"
  | "leadership"
  | "empathy";

export type DojoQuestion = {
  id: string;
  textKo: string;
  textEn: string;
  /** Default 1 — higher weight = more influence on area score. */
  weight?: number;
};

export type DojoAssessment = {
  id: string;
  titleKo: string;
  titleEn: string;
  skill_area: DojoSkillArea;
  questions: readonly DojoQuestion[];
  passing_score: number;
};

/** Six bilingual assessments (one per {@link DojoSkillArea}). */
export const DOJO_ASSESSMENTS: readonly DojoAssessment[] = [
  {
    id: "dojo_comm_v1",
    titleKo: "소통 · 경청 미니 진단",
    titleEn: "Communication & listening check-in",
    skill_area: "communication",
    passing_score: 70,
    questions: [
      {
        id: "q1",
        textKo: "상대가 말하는 동안 나는 반박을 준비하지 않고 끝까지 듣는다.",
        textEn: "While others speak, I listen to the end without preparing a rebuttal.",
      },
      {
        id: "q2",
        textKo: "나는 내 의견을 차분하고 구체적으로 전달한다.",
        textEn: "I express my views calmly and concretely.",
      },
      {
        id: "q3",
        textKo: "대화에서 상대의 비언어적 신호(침묵·어조)를 의식적으로 살핀다.",
        textEn: "In conversation I notice nonverbal cues (silence, tone) deliberately.",
      },
    ],
  },
  {
    id: "dojo_dec_v1",
    titleKo: "의사결정 미니 진단",
    titleEn: "Decision-making check-in",
    skill_area: "decision",
    passing_score: 70,
    questions: [
      {
        id: "q1",
        textKo: "정보가 불완전할 때도 기한 안에 선택을 내릴 수 있다.",
        textEn: "I can decide within deadlines even when information is incomplete.",
      },
      {
        id: "q2",
        textKo: "결정 후에는 이유를 짧게라도 공유해 이해를 맞춘다.",
        textEn: "After deciding, I share enough rationale so others can align.",
      },
      {
        id: "q3",
        textKo: "되돌릴 수 있는 결정과 없는 결정을 구분한다.",
        textEn: "I distinguish reversible decisions from irreversible ones.",
      },
    ],
  },
  {
    id: "dojo_res_v1",
    titleKo: "회복탄력 미니 진단",
    titleEn: "Resilience check-in",
    skill_area: "resilience",
    passing_score: 70,
    questions: [
      {
        id: "q1",
        textKo: "실패 후에도 다음 시도를 위한 에너지를 비교적 빨리 되찾는다.",
        textEn: "After setbacks I regain energy for the next attempt fairly quickly.",
      },
      {
        id: "q2",
        textKo: "스트레스 상황에서 호흡·우선순위로 나를 안정시킨다.",
        textEn: "Under stress I steady myself with breath and priorities.",
      },
      {
        id: "q3",
        textKo: "비판을 나 자신의 가치와 분리해서 받아들이려 한다.",
        textEn: "I try to separate criticism from my self-worth.",
      },
    ],
  },
  {
    id: "dojo_int_v1",
    titleKo: "무결성 미니 진단",
    titleEn: "Integrity check-in",
    skill_area: "integrity",
    passing_score: 70,
    questions: [
      {
        id: "q1",
        textKo: "약속한 기준(정책·윤리)을 상황이 힘들어도 우선한다.",
        textEn: "I uphold committed standards (policy, ethics) even when it is hard.",
      },
      {
        id: "q2",
        textKo: "불편한 사실을 숨기기보다 적절한 시점에 말한다.",
        textEn: "I surface uncomfortable facts at an appropriate time rather than hiding them.",
      },
      {
        id: "q3",
        textKo: "이해관계가 있을 때도 이해당사자에게 투명하게 공유한다.",
        textEn: "When interests conflict, I share transparently with stakeholders.",
      },
    ],
  },
  {
    id: "dojo_lead_v1",
    titleKo: "리더십 미니 진단",
    titleEn: "Leadership check-in",
    skill_area: "leadership",
    passing_score: 70,
    questions: [
      {
        id: "q1",
        textKo: "팀 목표가 불명확하면 방향을 정리하는 데 나서는 편이다.",
        textEn: "When team goals are unclear, I step in to clarify direction.",
      },
      {
        id: "q2",
        textKo: "맡은 일의 결과에 대해 명확히 책임진다.",
        textEn: "I take clear ownership of outcomes for what I commit to.",
      },
      {
        id: "q3",
        textKo: "강점이 다른 사람에게 역할을 맡기고 간섭을 최소화한다.",
        textEn: "I delegate to people’s strengths and avoid micromanaging.",
      },
    ],
  },
  {
    id: "dojo_emp_v1",
    titleKo: "공감 미니 진단",
    titleEn: "Empathy check-in",
    skill_area: "empathy",
    passing_score: 70,
    questions: [
      {
        id: "q1",
        textKo: "상대 입장에서 상황을 한 번 더 떠올려 본다.",
        textEn: "I imagine the situation from the other person’s perspective.",
      },
      {
        id: "q2",
        textKo: "감정이 격해진 상대에게 먼저 인정의 말을 할 수 있다.",
        textEn: "I can offer acknowledgment first when someone is emotionally charged.",
      },
      {
        id: "q3",
        textKo: "나와 다른 배경의 사람에게도 호기심을 유지한다.",
        textEn: "I stay curious toward people whose background differs from mine.",
      },
    ],
  },
] as const;

const ASSESSMENT_BY_ID = new Map(DOJO_ASSESSMENTS.map((a) => [a.id, a] as const));
const ASSESSMENT_BY_SKILL = new Map(DOJO_ASSESSMENTS.map((a) => [a.skill_area, a] as const));

const ALL_SKILLS: readonly DojoSkillArea[] = [
  "communication",
  "decision",
  "resilience",
  "integrity",
  "leadership",
  "empathy",
];

/**
 * Map Arena `flag_type` counts (from {@link ScenarioStats.playsByFlagType}) into skill-area coverage.
 * Unknown flags accrue to `resilience` / `decision` heuristics.
 */
export function flagTypeToSkillArea(flagType: string): DojoSkillArea {
  const f = flagType.trim().toUpperCase();
  if (f === "HERO_TRAP" || f.includes("LEAD") || f.includes("HERO")) return "leadership";
  if (f === "INTEGRITY_SLIP" || f.includes("INTEGRITY")) return "integrity";
  if (f === "CLEAN" || f.includes("COMMUNICATION")) return "communication";
  if (f === "ROLE_MIRROR" || f.includes("MIRROR") || f.includes("EMPATH")) return "empathy";
  if (f.includes("CONFLICT") || f.includes("NEGOTI") || f.includes("DECISION")) return "decision";
  return "resilience";
}

/** Skill area with least historical Arena coverage (tie → lexicographic skill name). */
export function weakestSkillAreaFromScenarioStats(stats: ScenarioStats): DojoSkillArea {
  const counts: Record<DojoSkillArea, number> = {
    communication: 0,
    decision: 0,
    resilience: 0,
    integrity: 0,
    leadership: 0,
    empathy: 0,
  };
  for (const [flag, n] of Object.entries(stats.playsByFlagType)) {
    const skill = flagTypeToSkillArea(flag);
    counts[skill] += typeof n === "number" && n > 0 ? n : 0;
  }
  let min = Infinity;
  for (const s of ALL_SKILLS) {
    const c = counts[s];
    if (c < min) min = c;
  }
  const tied = ALL_SKILLS.filter((s) => counts[s] === min).sort((a, b) => a.localeCompare(b));
  return tied[0] ?? "empathy";
}

function likert01(v: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  const x = Math.round(v);
  if (x < 1 || x > 5) return 0;
  return (x - 1) / 4;
}

/** 0–100: weighted mean of Likert 1–5 per question. */
export function scoreDojoAnswers(assessment: DojoAssessment, answers: Record<string, number>): number {
  let wSum = 0;
  let acc = 0;
  for (const q of assessment.questions) {
    const w = q.weight ?? 1;
    const a = answers[q.id];
    acc += likert01(a) * 100 * w;
    wSum += w;
  }
  if (wSum <= 0) return 0;
  return Math.round(acc / wSum);
}

export type DojoAssessmentAssignment = {
  attemptId: string;
  assessment: DojoAssessment;
};

export type DojoResult = {
  attemptId: string;
  assessmentId: string;
  skill_area: DojoSkillArea;
  passed: boolean;
  score: number;
  passing_score: number;
  submitted_at: string;
};

function resolveClient(supabase?: SupabaseClient): SupabaseClient | null {
  return supabase ?? getSupabaseAdmin();
}

/**
 * Pick assessment for `skill_area`, insert `user_dojo_attempts` row (open until submit).
 * When `skill_area` is omitted, uses {@link weakestSkillAreaFromScenarioStats} after {@link getScenarioStats}.
 */
export async function assignDojoAssessment(
  userId: string,
  skill_area?: DojoSkillArea,
  options?: { supabase?: SupabaseClient; locale?: ScenarioLocalePreference },
): Promise<DojoAssessmentAssignment> {
  const client = resolveClient(options?.supabase);
  if (!client) {
    throw new Error("assignDojoAssessment: Supabase client not available");
  }

  let area = skill_area;
  if (!area) {
    const stats = await getScenarioStats(userId, options?.locale ?? "en");
    area = weakestSkillAreaFromScenarioStats(stats);
  }

  const assessment = ASSESSMENT_BY_SKILL.get(area);
  if (!assessment) {
    throw new Error(`assignDojoAssessment: no assessment for skill_area ${area}`);
  }

  const { data, error } = await client
    .from("user_dojo_attempts")
    .insert({
      user_id: userId,
      assessment_id: assessment.id,
      skill_area: assessment.skill_area,
    })
    .select("id")
    .single();

  if (error) throw new Error(`assignDojoAssessment: ${error.message}`);
  const attemptId = (data as { id?: string }).id;
  if (typeof attemptId !== "string") throw new Error("assignDojoAssessment: missing attempt id");

  return { attemptId, assessment };
}

/**
 * Call when a Foundry learning program is marked complete — assigns weakest-skill assessment.
 */
export async function assignDojoAssessmentOnFoundryProgramCompletion(
  userId: string,
  options?: { supabase?: SupabaseClient; locale?: ScenarioLocalePreference },
): Promise<DojoAssessmentAssignment> {
  return assignDojoAssessment(userId, undefined, options);
}

function validateAnswersShape(assessment: DojoAssessment, answers: Record<string, number>): string | null {
  for (const q of assessment.questions) {
    const v = answers[q.id];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) {
      return `invalid_answer:${q.id}`;
    }
  }
  return null;
}

/**
 * Submit answers for the latest open attempt matching `assessmentId` (Likert 1–5 per question id).
 */
export async function submitDojoResult(
  userId: string,
  assessmentId: string,
  answers: Record<string, number>,
  options?: { supabase?: SupabaseClient },
): Promise<DojoResult> {
  const client = resolveClient(options?.supabase);
  if (!client) {
    throw new Error("submitDojoResult: Supabase client not available");
  }

  const assessment = ASSESSMENT_BY_ID.get(assessmentId);
  if (!assessment) {
    throw new Error(`submitDojoResult: unknown assessment ${assessmentId}`);
  }

  const bad = validateAnswersShape(assessment, answers);
  if (bad) throw new Error(bad);

  const { data: row, error: fetchErr } = await client
    .from("user_dojo_attempts")
    .select("id, user_id, assessment_id, submitted_at")
    .eq("user_id", userId)
    .eq("assessment_id", assessmentId)
    .is("submitted_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!row) {
    throw new Error("submitDojoResult: no open attempt; call assignDojoAssessment first");
  }

  const attemptId = (row as { id: string }).id;
  const score = scoreDojoAnswers(assessment, answers);
  const passed = score >= assessment.passing_score;
  const submitted_at = new Date().toISOString();

  const { error: upErr } = await client
    .from("user_dojo_attempts")
    .update({
      answers_json: answers,
      score,
      passed,
      submitted_at,
    })
    .eq("id", attemptId)
    .eq("user_id", userId);

  if (upErr) throw new Error(upErr.message);

  return {
    attemptId,
    assessmentId: assessment.id,
    skill_area: assessment.skill_area,
    passed,
    score,
    passing_score: assessment.passing_score,
    submitted_at,
  };
}

/** Load assessment definition by id (for UI). */
export function getDojoAssessmentById(id: string): DojoAssessment | undefined {
  return ASSESSMENT_BY_ID.get(id);
}

/** Server user JWT path (RLS). */
export async function assignDojoAssessmentAsUser(
  userId: string,
  skill_area?: DojoSkillArea,
  locale?: ScenarioLocalePreference,
): Promise<DojoAssessmentAssignment> {
  const supabase = await getSupabaseServerClient();
  return assignDojoAssessment(userId, skill_area, { supabase, locale });
}

export async function submitDojoResultAsUser(
  userId: string,
  assessmentId: string,
  answers: Record<string, number>,
): Promise<DojoResult> {
  const supabase = await getSupabaseServerClient();
  return submitDojoResult(userId, assessmentId, answers, { supabase });
}
