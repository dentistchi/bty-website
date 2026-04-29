// bty-app/src/lib/assessment/score.ts
export type Dimension = "core" | "compassion" | "stability" | "growth" | "social";

export type Question = {
  id: number;
  dimension: Dimension;
  text: string;
  reverse: boolean;
};

export type Scores = Record<Dimension, number>;

export type Pattern =
  | "balanced"
  | "perfectionism"
  | "approval_seeking"
  | "fragile_self_esteem"
  | "low_self_compassion"
  | "growth_blocked"
  | "social_avoidance";

export type Track = "Stability First" | "Self-Compassion First" | "Core Confidence" | "Growth Momentum" | "Social Ease";

export function reverseScore(raw1to5: number): number {
  // 1↔5, 2↔4, 3↔3
  return 6 - raw1to5;
}

export function to0to100(sum10to50: number): number {
  // 10문항 * 1~5점 => 10~50
  // 10->0, 50->100
  const v = ((sum10to50 - 10) / 40) * 100;
  return Math.round(v);
}

export function scoreAnswers(
  questions: Question[],
  answersById: Record<number, number> // { [id]: 1..5 }
): Scores {
  const sums: Record<Dimension, number> = {
    core: 0,
    compassion: 0,
    stability: 0,
    growth: 0,
    social: 0,
  };

  for (const q of questions) {
    const raw = answersById[q.id];
    if (!(raw >= 1 && raw <= 5)) {
      throw new Error(`답변 누락/범위 오류: Q${q.id}=${raw}`);
    }
    const scored = q.reverse ? reverseScore(raw) : raw;
    sums[q.dimension] += scored;
  }

  return {
    core: to0to100(sums.core),
    compassion: to0to100(sums.compassion),
    stability: to0to100(sums.stability),
    growth: to0to100(sums.growth),
    social: to0to100(sums.social),
  };
}

export function detectPattern(scores: Scores): { pattern: Pattern; track: Track; reasons: string[] } {
  const { core, compassion, stability, growth, social } = scores;

  // 룰은 "최소 버전"부터. (나중에 정교화 가능)
  // 기준: <50 낮음, 50~69 중간, >=70 높음
  const low = (x: number) => x < 50;
  const high = (x: number) => x >= 70;

  // 완벽주의: core 높고 compassion 낮음
  if (high(core) && low(compassion)) {
    return {
      pattern: "perfectionism",
      track: "Self-Compassion First",
      reasons: ["핵심 자존감은 버티는데, 실수/실패에서 자기비난이 강하게 작동하는 패턴"],
    };
  }

  // 승인 갈구: social만 낮음
  if (low(social) && !low(core) && !low(compassion) && !low(stability) && !low(growth)) {
    return {
      pattern: "approval_seeking",
      track: "Social Ease",
      reasons: ["관계 장면에서 평가 민감도가 핵심 병목"],
    };
  }

  // 자존감 불안정: stability 낮음
  if (low(stability)) {
    return {
      pattern: "fragile_self_esteem",
      track: "Stability First",
      reasons: ["외부 피드백/상황 변화에서 흔들림이 커서 방어적 반응이 쉽게 올라오는 패턴"],
    };
  }

  // 자기자비 낮음
  if (low(compassion)) {
    return {
      pattern: "low_self_compassion",
      track: "Self-Compassion First",
      reasons: ["자기비난이 과도하면 실천 유지가 어려워져, 먼저 자기자비 기반을 다지는 편이 유리"],
    };
  }

  // 성장 마인드셋 낮음
  if (low(growth)) {
    return {
      pattern: "growth_blocked",
      track: "Growth Momentum",
      reasons: ["도전/학습을 '위협'으로 해석하는 경향이 있어 작은 성공 설계가 중요"],
    };
  }

  // 사회적 회피
  if (low(social)) {
    return {
      pattern: "social_avoidance",
      track: "Social Ease",
      reasons: ["관계 장면에서 위축/회피가 실천을 끊기게 만드는 주요 트리거"],
    };
  }

  return {
    pattern: "balanced",
    track: "Core Confidence",
    reasons: ["전반적으로 균형적. 코어를 유지하면서 28일 루틴으로 점진 강화 추천"],
  };
}
