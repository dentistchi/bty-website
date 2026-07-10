/**
 * Synthetic fixtures for the pilot read-only shadow tests. No real DB, no real ids, no secrets.
 */
import type { TodayIntelligence } from "@/domain/daily/todayIntelligence";
import type {
  NormalizedCompletion,
  NormalizedReexposure,
  NormalizedRepeated,
} from "@/domain/daily/todayMirrorSignals";
import type { PilotShadowConfigResult } from "@/lib/bty/today-intelligence/pilotShadowConfig";
import type { PilotSignalReaders } from "@/lib/bty/today-intelligence/pilotShadow";

/** A syntactically valid (synthetic) UUID + a real IANA zone. Not a real account. */
export const SYNTH_USER_ID = "11111111-2222-4333-8444-555555555555";
export const SYNTH_TZ = "America/Los_Angeles";

export function okConfig(over?: Partial<{ userId: string; timezone: string }>): PilotShadowConfigResult {
  return { ok: true, config: { userId: over?.userId ?? SYNTH_USER_ID, timezone: over?.timezone ?? SYNTH_TZ } };
}

/** A clean brief that contributes NO context signals and NO read-error → only injected signals drive. */
export const CLEAN_BRIEF: TodayIntelligence = {
  userState: "clean_start",
  relationshipFocus: "CleanStart",
  confidence: "none",
  reasonCodes: [],
  fallbackMode: "no_evidence",
};

export type FakeReaderInputs = {
  completions?: NormalizedCompletion[];
  reexposure?: NormalizedReexposure | null;
  repeated?: NormalizedRepeated | null;
  brief?: TodayIntelligence;
};

/** Records every userId each reader was called with, for scope assertions. */
export type ReaderSpy = { userIds: string[]; briefUserIds: string[] };

export function makeFakeReaders(inputs: FakeReaderInputs, spy: ReaderSpy = { userIds: [], briefUserIds: [] }): { readers: PilotSignalReaders; spy: ReaderSpy } {
  const readers: PilotSignalReaders = {
    async readCompletionsForLatency(userId) {
      spy.userIds.push(userId);
      return inputs.completions ?? [];
    },
    async readTopSignature(userId) {
      spy.userIds.push(userId);
      return { reexposure: inputs.reexposure ?? null, repeated: inputs.repeated ?? null };
    },
    async buildBrief(userId) {
      spy.briefUserIds.push(userId);
      return inputs.brief ?? CLEAN_BRIEF;
    },
  };
  return { readers, spy };
}

/** A changed re-exposure with FULL comparison provenance (→ high). */
export const REEXPOSURE_CHANGED: NormalizedReexposure = {
  signatureId: "sig-synth",
  patternFamily: "repair_avoidance",
  axis: "repair",
  repeatCount: 3,
  lastValidationResult: "changed",
  confidenceScore: 0.8,
  lastSeenAt: "2026-07-09T12:00:00Z",
  relationship: "Others",
  priorEventId: "e-prior",
  laterEventId: "e-later",
};

/** Two same-family completions where the later interval is shorter (→ LATENCY_SHORTENED). */
export function shorterLatencyCompletions(userId = SYNTH_USER_ID): NormalizedCompletion[] {
  return [
    { id: "p", patternFamily: "future_deferral", chosenAt: "2026-07-08T10:00:00Z", verifiedAt: "2026-07-08T14:00:00Z", userId },
    { id: "c", patternFamily: "future_deferral", chosenAt: "2026-07-09T10:00:00Z", verifiedAt: "2026-07-09T11:00:00Z", userId },
  ];
}
