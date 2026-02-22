/**
 * BTY Arena Core Engine (Pure Functions)
 * - UI/DB/네트워크와 분리된 "결정 엔진"
 * - 현재는 MVP 결과를 유지한다:
 *   - xp = round(xpBase * difficulty), xp >= 0
 *   - systemMessage 규칙(감사>=2, integrity>=3, xp>=90) 동일
 *   - follow-up XP = 0 고정
 */

export type HiddenDelta = Partial<{
  integrity: number;
  communication: number;
  insight: number;
  resilience: number;
  gratitude: number;
}>;

export type SystemMessageId =
  | "arch_init"
  | "telemetry"
  | "gratitude"
  | "consistency"
  | "integrity"
  // 확장용
  | "unknown";

export type EngineChoiceInput = {
  scenarioId: string;
  choiceId: string;
  intent?: string;
  xpBase: number;
  difficulty?: number;
  hiddenDelta?: HiddenDelta;
};

export type EngineFollowUpInput = {
  scenarioId: string;
  choiceId: string;
  followUpIndex: number;
};

export type EngineOutput = {
  xp: number;
  deltas: HiddenDelta;
  tags: string[]; // 향후 리그/대시보드 집계에 사용
  systemMessageId: SystemMessageId;
};

function n(v: unknown): number {
  const x = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return x;
}

export function computeXp(xpBase: number, difficulty?: number): number {
  const base = n(xpBase);
  const diff = difficulty == null ? 1 : n(difficulty);
  const raw = base * diff;
  const rounded = Math.round(raw);
  return Math.max(0, rounded);
}

export function pickSystemMessageId(params: { xp: number; deltas?: HiddenDelta }): SystemMessageId {
  const xp = n(params.xp);
  const deltas = params.deltas ?? {};
  const gratitude = n(deltas.gratitude);
  const integrity = n(deltas.integrity);

  // ✅ 기존 MVP 로직 유지
  if (gratitude >= 2) return "gratitude";
  if (integrity >= 3) return "integrity";
  if (xp >= 90) return "telemetry";
  return "arch_init";
}

export function evaluateChoice(input: EngineChoiceInput): EngineOutput {
  const deltas: HiddenDelta = input.hiddenDelta ?? {};
  const xp = computeXp(input.xpBase, input.difficulty);

  const tags: string[] = [
    `scenario:${input.scenarioId}`,
    `choice:${input.choiceId}`,
    input.intent ? `intent:${input.intent}` : "intent:unknown",
    xp >= 90 ? "xp:high" : xp >= 60 ? "xp:mid" : "xp:low",
  ];

  const systemMessageId = pickSystemMessageId({ xp, deltas });

  return { xp, deltas, tags, systemMessageId };
}

export function evaluateFollowUp(_input: EngineFollowUpInput): EngineOutput {
  // ✅ MVP 고정 정책: follow-up은 XP 0
  const xp = 0;
  const deltas: HiddenDelta = {};
  const tags: string[] = ["followup:selected"];
  const systemMessageId: SystemMessageId = "arch_init";
  return { xp, deltas, tags, systemMessageId };
}
