import type { ReflectionEntry } from "@/features/growth/logic/types";

const FOCUS: ReflectionEntry["focus"][] = ["clarity", "trust", "regulation", "alignment"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseArenaSignalBody(raw: unknown):
  | {
      scenarioId: string;
      primaryChoice: string;
      reinforcementChoice: string;
      traits: Record<string, number>;
      meta: {
        relationalBias: number;
        operationalBias: number;
        emotionalRegulation: number;
      };
    }
  | { error: string } {
  if (!isRecord(raw)) return { error: "Invalid JSON body" };
  const scenarioId = String(raw.scenarioId ?? "").trim();
  const primaryChoice = String(raw.primaryChoice ?? "").trim();
  const reinforcementChoice = String(raw.reinforcementChoice ?? "").trim();
  if (!scenarioId || !primaryChoice || !reinforcementChoice) {
    return { error: "scenarioId, primaryChoice, reinforcementChoice are required" };
  }
  const traitsRaw = raw.traits;
  if (!isRecord(traitsRaw)) return { error: "traits must be an object" };
  const traits: Record<string, number> = {};
  for (const [k, v] of Object.entries(traitsRaw)) {
    const n = Number(v);
    if (!Number.isFinite(n)) return { error: `traits.${k} must be a number` };
    traits[k] = n;
  }
  const metaRaw = raw.meta;
  if (!isRecord(metaRaw)) return { error: "meta must be an object" };
  const relationalBias = Number(metaRaw.relationalBias);
  const operationalBias = Number(metaRaw.operationalBias);
  const emotionalRegulation = Number(metaRaw.emotionalRegulation);
  if (![relationalBias, operationalBias, emotionalRegulation].every((x) => Number.isFinite(x))) {
    return { error: "meta.relationalBias, meta.operationalBias, meta.emotionalRegulation must be numbers" };
  }
  return {
    scenarioId,
    primaryChoice,
    reinforcementChoice,
    traits,
    meta: { relationalBias, operationalBias, emotionalRegulation },
  };
}

export function parseReflectionWriteBody(raw: unknown):
  | {
      seedId?: string;
      scenarioId: string;
      focus: ReflectionEntry["focus"];
      promptTitle: string;
      promptBody: string;
      cue: string;
      answer1: string;
      answer2: string;
      answer3: string;
      commitment: string;
    }
  | { error: string } {
  if (!isRecord(raw)) return { error: "Invalid JSON body" };
  const scenarioId = String(raw.scenarioId ?? "").trim();
  const focus = raw.focus as string;
  if (!FOCUS.includes(focus as ReflectionEntry["focus"])) {
    return { error: "focus must be clarity | trust | regulation | alignment" };
  }
  const promptTitle = String(raw.promptTitle ?? "").trim();
  const promptBody = String(raw.promptBody ?? "").trim();
  const cue = String(raw.cue ?? "").trim();
  const answer1 = String(raw.answer1 ?? "").trim();
  const answer2 = String(raw.answer2 ?? "").trim();
  const answer3 = String(raw.answer3 ?? "").trim();
  const commitment = String(raw.commitment ?? "").trim();
  if (!scenarioId || !promptTitle || !promptBody || !cue) {
    return { error: "scenarioId, promptTitle, promptBody, cue are required" };
  }
  if (!answer1 || !answer2 || !answer3 || !commitment) {
    return { error: "answer1, answer2, answer3, commitment are required" };
  }
  let seedId: string | undefined;
  if (raw.seedId != null && raw.seedId !== "") {
    const s = String(raw.seedId).trim();
    if (!/^[0-9a-f-]{36}$/i.test(s)) return { error: "seedId must be a UUID when provided" };
    seedId = s;
  }
  return {
    seedId,
    scenarioId,
    focus: focus as ReflectionEntry["focus"],
    promptTitle,
    promptBody,
    cue,
    answer1,
    answer2,
    answer3,
    commitment,
  };
}

const RECOVERY_SOURCES = ["growth", "arena"] as const;
const RECOVERY_REASONS = ["low-regulation", "repeated-friction", "pressure-accumulation"] as const;

export function parseRecoveryBody(raw: unknown):
  | {
      source: (typeof RECOVERY_SOURCES)[number];
      reason: (typeof RECOVERY_REASONS)[number];
      promptTitle: string;
      promptBody: string;
      cue: string;
      patternNote: string;
      resetAction: string;
      reentryCommitment: string;
    }
  | { error: string } {
  if (!isRecord(raw)) return { error: "Invalid JSON body" };
  const source = String(raw.source ?? "");
  const reason = String(raw.reason ?? "");
  if (!RECOVERY_SOURCES.includes(source as (typeof RECOVERY_SOURCES)[number])) {
    return { error: "source must be growth | arena" };
  }
  if (!RECOVERY_REASONS.includes(reason as (typeof RECOVERY_REASONS)[number])) {
    return { error: "reason must be low-regulation | repeated-friction | pressure-accumulation" };
  }
  const promptTitle = String(raw.promptTitle ?? "").trim();
  const promptBody = String(raw.promptBody ?? "").trim();
  const cue = String(raw.cue ?? "").trim();
  const patternNote = String(raw.patternNote ?? "").trim();
  const resetAction = String(raw.resetAction ?? "").trim();
  const reentryCommitment = String(raw.reentryCommitment ?? "").trim();
  if (!promptTitle || !promptBody || !cue || !patternNote || !resetAction || !reentryCommitment) {
    return { error: "promptTitle, promptBody, cue, patternNote, resetAction, reentryCommitment are required" };
  }
  return {
    source: source as (typeof RECOVERY_SOURCES)[number],
    reason: reason as (typeof RECOVERY_REASONS)[number],
    promptTitle,
    promptBody,
    cue,
    patternNote,
    resetAction,
    reentryCommitment,
  };
}
