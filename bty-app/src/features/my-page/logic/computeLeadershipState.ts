import { AIR_BAND_LOW_MID, AIR_BAND_MID_HIGH, airToBand } from "@/domain/leadership-engine/air";
import type { ReflectionEntry } from "@/features/growth/logic/types";
import type { Locale } from "@/lib/i18n";
import type { LeadershipMetrics, LeadershipState } from "./types";

const CODE_NAME = "STILLWATER";
const STAGE = "STAGE 1: FORGE";

type Copy = {
  dormantAir: string;
  dormantTii: string;
  dormantRhythm: string;
  dormantRel: string;
  dormantOp: string;
  dormantEmo: string;
  dormantTeam: string;
  dormantInfluence: string;
  dormantAlign: string;
  dormantNextFocus: string;
  dormantNextCue: string;
  identityNoSignals: string;
  strStrong: string;
  strBalanced: string;
  strLow: string;
  strControlled: string;
  emoStable: string;
  emoImproving: string;
  emoFragile: string;
  teamStable: string;
  teamDeveloping: string;
  teamFragile: string;
  inflTrust: string;
  inflStructure: string;
  alignUp: string;
  alignStabilizing: string;
  alignUneven: string;
  identityStable: string;
  identityEmerging: string;
  identityCalibrating: string;
  identityWithReflections: string;
  nextFocusReflectRegulation: string;
  nextFocusReflectClarity: string;
  nextCueReflectRegulation: string;
};

const EN: Copy = {
  dormantAir: "Pattern not yet measured",
  dormantTii: "Team influence not yet measured",
  dormantRhythm: "Rhythm calibrating",
  dormantRel: "—",
  dormantOp: "—",
  dormantEmo: "—",
  dormantTeam: "Awaiting signal",
  dormantInfluence: "Awaiting signal",
  dormantAlign: "Awaiting signal",
  dormantNextFocus: "Complete an Arena scenario to form your first leadership pattern.",
  dormantNextCue: "One sealed decision begins the trace.",
  identityNoSignals: "No Arena patterns recorded yet. Your console activates after the first sealed decision.",
  strStrong: "Strong",
  strBalanced: "Balanced",
  strLow: "Low",
  strControlled: "Controlled",
  emoStable: "Stable",
  emoImproving: "Improving",
  emoFragile: "Fragile",
  teamStable: "Stable",
  teamDeveloping: "Developing",
  teamFragile: "Fragile",
  inflTrust: "Trust-preserving",
  inflStructure: "Structure-preserving",
  alignUp: "Upward",
  alignStabilizing: "Stabilizing",
  alignUneven: "Uneven",
  identityStable: "Current leadership state is stabilizing.",
  identityEmerging: "Leadership pattern is emerging from recent decisions.",
  identityCalibrating: "System is calibrating to your decision rhythm.",
  identityWithReflections:
    "Arena signals and reflection patterns are stabilizing your leadership state.",
  nextFocusReflectRegulation: "Rebuild regulation before the next escalation cycle.",
  nextFocusReflectClarity: "Protect trust without losing explanation clarity.",
  nextCueReflectRegulation: "Use recovery before high-pressure re-entry.",
};

const KO: Copy = {
  dormantAir: "아직 측정된 패턴 없음",
  dormantTii: "팀 영향 아직 측정 전",
  dormantRhythm: "리듬 보정 중",
  dormantRel: "—",
  dormantOp: "—",
  dormantEmo: "—",
  dormantTeam: "신호 대기",
  dormantInfluence: "신호 대기",
  dormantAlign: "신호 대기",
  dormantNextFocus: "Arena 시나리오를 완료하면 첫 리더십 패턴이 형성됩니다.",
  dormantNextCue: "한 번의 밀봉된 결정이 궤적을 시작합니다.",
  identityNoSignals: "Arena 패턴이 아직 없습니다. 첫 밀봉 결정 후 콘솔이 활성화됩니다.",
  strStrong: "강함",
  strBalanced: "균형",
  strLow: "낮음",
  strControlled: "절제됨",
  emoStable: "안정",
  emoImproving: "개선 중",
  emoFragile: "취약",
  teamStable: "안정",
  teamDeveloping: "발전 중",
  teamFragile: "취약",
  inflTrust: "신뢰 보존형",
  inflStructure: "구조 보존형",
  alignUp: "상향",
  alignStabilizing: "안정화",
  alignUneven: "불균형",
  identityStable: "현재 리더십 상태는 안정 쪽으로 수렴하고 있습니다.",
  identityEmerging: "최근 결정에서 리더십 패턴이 드러나기 시작했습니다.",
  identityCalibrating: "결정 리듬에 맞추어 시스템이 보정 중입니다.",
  identityWithReflections:
    "Arena 신호와 성찰 패턴이 리더십 상태를 함께 안정시키는 중입니다.",
  nextFocusReflectRegulation: "다음 에스컬레이션 전에 조절을 다시 세우세요.",
  nextFocusReflectClarity: "설명 명료성을 잃지 않고 신뢰를 지키세요.",
  nextCueReflectRegulation: "고압 재진입 전에 회복을 사용하세요.",
};

function L(locale: Locale): Copy {
  return locale === "ko" ? KO : EN;
}

function tierRelational(v: number, c: Copy): string {
  if (v >= 0.75) return c.strStrong;
  if (v >= 0.5) return c.strBalanced;
  return c.strLow;
}

function tierOperational(v: number, c: Copy): string {
  if (v >= 0.75) return c.strStrong;
  if (v >= 0.5) return c.strControlled;
  return c.strBalanced;
}

function tierEmotional(v: number, c: Copy): string {
  if (v >= 0.75) return c.emoStable;
  if (v >= 0.5) return c.emoImproving;
  return c.emoFragile;
}

/** Arena metrics (+ optional recent reflections) → calm leadership language (no raw score UI). */
export function computeLeadershipState(
  metrics: LeadershipMetrics,
  locale: Locale,
  reflections: ReflectionEntry[] = [],
): LeadershipState {
  const c = L(locale);

  if (metrics.signalCount === 0) {
    return {
      codeName: CODE_NAME,
      stage: STAGE,
      headline: c.identityNoSignals,
      airLabel: c.dormantAir,
      tiiLabel: c.dormantTii,
      rhythmLabel: c.dormantRhythm,
      relationalLabel: c.dormantRel,
      operationalLabel: c.dormantOp,
      emotionalLabel: c.dormantEmo,
      teamSignal: c.dormantTeam,
      influencePattern: c.dormantInfluence,
      alignmentTrend: c.dormantAlign,
      nextFocus: c.dormantNextFocus,
      nextCue: c.dormantNextCue,
    };
  }

  const airBand = airToBand(metrics.AIR);
  const airLabel =
    airBand === "high"
      ? locale === "ko"
        ? "실행 무결성 — 고밴드"
        : "Execution integrity — high band"
      : airBand === "mid"
        ? locale === "ko"
          ? "실행 무결성 — 중밴드"
          : "Execution integrity — mid band"
        : locale === "ko"
          ? "실행 무결성 — 저밴드"
          : "Execution integrity — low band";

  const tiiLabel =
    metrics.TII >= 0.8
      ? locale === "ko"
        ? "높은 관계 영향"
        : "High Relational Influence"
      : metrics.TII >= 0.6
        ? locale === "ko"
          ? "안정적인 팀 신호"
          : "Stable Team Signal"
        : locale === "ko"
          ? "팀 안정성 제한적"
          : "Limited Team Stability";

  const rhythmLabel =
    metrics.emotionalRegulation >= 0.8
      ? locale === "ko"
        ? "압박 속에서도 일관"
        : "Consistent under pressure"
      : metrics.emotionalRegulation >= 0.6
        ? locale === "ko"
          ? "긴장 속 회복 중"
          : "Recovering under tension"
        : locale === "ko"
          ? "압박에 반응적"
          : "Reactive under pressure";

  const relationalLabel = tierRelational(metrics.relationalBias, c);
  const operationalLabel = tierOperational(metrics.operationalBias, c);
  const emotionalLabel = tierEmotional(metrics.emotionalRegulation, c);

  const teamSignal =
    metrics.TII >= 0.75 ? c.teamStable : metrics.TII >= 0.5 ? c.teamDeveloping : c.teamFragile;

  const influencePattern =
    metrics.relationalBias >= metrics.operationalBias ? c.inflTrust : c.inflStructure;

  const alignmentTrend =
    metrics.AIR >= AIR_BAND_MID_HIGH && metrics.TII >= 0.7
      ? c.alignUp
      : metrics.AIR >= AIR_BAND_LOW_MID
        ? c.alignStabilizing
        : c.alignUneven;

  const baseNextFocus =
    metrics.relationalBias > metrics.operationalBias
      ? locale === "ko"
        ? "긴장 상황에서 운영적 명료를 지키세요."
        : "Protect operational clarity under tension."
      : locale === "ko"
        ? "구조를 잃지 않고 관계 신뢰를 지키세요."
        : "Protect relational trust without losing structure.";

  const baseNextCue =
    metrics.AIR >= AIR_BAND_MID_HIGH
      ? locale === "ko"
        ? "더 높은 압박의 시나리오 주기로 진행해 보세요."
        : "Advance through higher-pressure scenario cycles."
      : locale === "ko"
        ? "확대 전에 설명 품질을 다시 굳히세요."
        : "Reinforce explanation quality before escalation.";

  let nextFocus = baseNextFocus;
  let nextCue = baseNextCue;

  const chronological = [...reflections].sort((a, b) => a.createdAt - b.createdAt);
  const recent = chronological.slice(-5);
  const regulationCount = recent.filter((r) => r.focus === "regulation").length;
  const clarityCount = recent.filter((r) => r.focus === "clarity").length;

  if (reflections.length > 0) {
    if (regulationCount >= 2) {
      nextFocus = c.nextFocusReflectRegulation;
      nextCue = c.nextCueReflectRegulation;
    } else if (clarityCount >= 2) {
      nextFocus = c.nextFocusReflectClarity;
      nextCue = baseNextCue;
    }
  }

  let headline = c.identityCalibrating;
  if (reflections.length > 0) {
    headline = c.identityWithReflections;
  } else if (metrics.AIR >= AIR_BAND_MID_HIGH && metrics.TII >= 0.6) headline = c.identityStable;
  else if (
    metrics.signalCount >= 1 &&
    (metrics.AIR >= AIR_BAND_LOW_MID || metrics.TII > 0.45)
  )
    headline = c.identityEmerging;

  return {
    codeName: CODE_NAME,
    stage: STAGE,
    headline,
    airLabel,
    tiiLabel,
    rhythmLabel,
    relationalLabel,
    operationalLabel,
    emotionalLabel,
    teamSignal,
    influencePattern,
    alignmentTrend,
    nextFocus,
    nextCue,
  };
}


/** UI-only trace line under System Note (not a raw score). */
export function leadershipCoreTraceLabel(signalCount: number, locale: Locale): string {
  const c = L(locale);
  if (signalCount === 0) return locale === "ko" ? "—" : "—";
  if (signalCount >= 5) return locale === "ko" ? "궤적 심화" : "Deepening trace";
  if (signalCount >= 2) return locale === "ko" ? "패턴 축적 중" : "Pattern building";
  return locale === "ko" ? "초기 궤적" : "Early trace";
}
