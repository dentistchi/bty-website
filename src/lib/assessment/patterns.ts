import type { AssessmentResult, BarrierKey, DimensionScores, PatternKey } from "./types";

function avg(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0) / Math.max(1, nums.length);
}

export function detectPattern(scores: DimensionScores): PatternKey {
  const core = scores.core_self_esteem;
  const comp = scores.self_compassion;
  const stab = scores.self_esteem_stability;
  const grow = scores.growth_mindset;
  const soc = scores.social_self_esteem;

  const othersAvg = avg([core, comp, stab, grow].filter(Boolean));

  // Examples based on your spec
  if (core >= 65 && comp < 50) return "perfectionism";
  if (soc < 50 && avg([core, comp, stab, grow]) >= 55) return "approval_seeking";
  if (stab < 50) return "fragile_stability";
  if (grow < 50) return "low_growth_fuel";
  if (core < 45 && comp < 45) return "self_criticism_loop";

  // Balanced if no major alarms and shape is relatively even
  const spread = Math.max(core, comp, stab, grow, soc) - Math.min(core, comp, stab, grow, soc);
  if (spread <= 18 && othersAvg >= 55) return "balanced";

  return "balanced";
}

export function detectBarriers(scores: DimensionScores): BarrierKey[] {
  const pairs: { k: BarrierKey; v: number }[] = [
    { k: "low_compassion", v: scores.self_compassion },
    { k: "low_stability", v: scores.self_esteem_stability },
    { k: "low_core", v: scores.core_self_esteem },
    { k: "low_social", v: scores.social_self_esteem },
    { k: "low_growth", v: scores.growth_mindset },
  ];

  // below 50 is a barrier; pick top 1~2 lowest
  const low = pairs.filter((p) => p.v < 50).sort((a, b) => a.v - b.v);
  return low.slice(0, 2).map((p) => p.k);
}

export function recommendTrack(scores: DimensionScores): string {
  // Keep it simple & explainable
  const barriers = detectBarriers(scores);
  if (barriers.includes("low_stability")) return "Stability Reset";
  if (barriers.includes("low_compassion")) return "Compassion First";
  if (barriers.includes("low_core")) return "Core Worth Rebuild";
  if (barriers.includes("low_social")) return "Social Safety & Boundaries";
  if (barriers.includes("low_growth")) return "Growth Momentum";
  return "Balanced Growth";
}

const BARRIER_LABEL_KO: Record<BarrierKey, string> = {
  low_compassion: "자기자비",
  low_stability: "안정성",
  low_core: "핵심 자존감",
  low_social: "사회적 자존감",
  low_growth: "성장 마인드셋",
};

const BARRIER_LABEL_EN: Record<BarrierKey, string> = {
  low_compassion: "Self-compassion",
  low_stability: "Stability",
  low_core: "Core self-worth",
  low_social: "Social self-esteem",
  low_growth: "Growth mindset",
};

export function buildOnePageSummary(scores: DimensionScores): Pick<
  AssessmentResult,
  "summaryTitle_en" | "summaryTitle_ko" | "summaryBody_en" | "summaryBody_ko"
> {
  const pattern = detectPattern(scores);
  const barriers = detectBarriers(scores);

  const title_en: Record<string, string> = {
    perfectionism: "High standards, low kindness to self",
    approval_seeking: "Your confidence depends too much on others",
    fragile_stability: "Small feedback feels like a threat",
    low_growth_fuel: "You're stuck — not because you can't, but because you're tired",
    self_criticism_loop: "Self-worth is being attacked from the inside",
    balanced: "A workable foundation — now we build momentum",
  };

  const title_ko: Record<string, string> = {
    perfectionism: "기준은 높은데, 나에게 너무 가혹해요",
    approval_seeking: "타인의 시선이 나를 흔들어요",
    fragile_stability: "작은 자극에도 자존감이 크게 흔들려요",
    low_growth_fuel: "못해서가 아니라, 지쳐서 멈춘 상태예요",
    self_criticism_loop: "내 안에서 자존감이 계속 공격받고 있어요",
    balanced: "기반은 괜찮아요 — 이제 속도를 붙이면 돼요",
  };

  const barrierLine_ko =
    barriers.length > 0
      ? `우선순위 장벽: ${barriers.map((b) => BARRIER_LABEL_KO[b]).join(" · ")}`
      : "현재 큰 장벽 신호는 적습니다.";

  const barrierLine_en =
    barriers.length > 0
      ? `Top barriers: ${barriers.map((b) => BARRIER_LABEL_EN[b]).join(" · ")}`
      : "No strong barrier signals detected.";

  return {
    summaryTitle_en: title_en[pattern] ?? title_en.balanced,
    summaryTitle_ko: title_ko[pattern] ?? title_ko.balanced,
    summaryBody_en: `${barrierLine_en}\nThis chart is not a grade. It's an energy map — where protection kicks in, and where healing should start.`,
    summaryBody_ko: `${barrierLine_ko}\n이 차트는 성적표가 아니라 '에너지 지도'예요. 방어가 작동하는 지점과, 돌봄을 시작할 지점을 보여줘요.`,
  };
}
