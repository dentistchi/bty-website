/**
 * BTY Today AI Mirror — pilot READ-ONLY evidence shadow orchestrator (server-only, value-safe).
 *
 * A future, separately-authorized run may point this at ONE explicit pilot user, read-only, to
 * produce a value-safe evidence STATUS (never contents). This module builds that capability and
 * proves it under synthetic dependency injection. It has NO provider path (no LLM import) and NO
 * mutation path (readers are narrow read-only functions), and it never serializes the real packet.
 *
 * Arming is intentionally hard: the caller must both (a) pass `armed: true` (the script derives
 * this from TODAY_MIRROR_REAL_SHADOW=1 AND a --execute-read-only flag) and (b) supply readers. The
 * default, unarmed path performs config validation only — no query, no assembly.
 *
 * IMPORTANT: importing this module must not transitively import any generation/provider code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assembleTodayMirrorPacket,
  readCompletionsForLatency,
  readTopSignature,
} from "@/lib/bty/today-intelligence/todayMirrorEvidence.server";
import { buildTodayIntelligence } from "@/lib/bty/daily/todayIntelligence.server";
import { selectMirrorLens } from "@/domain/daily/todayMirrorLens";
import { admitTodayMirrorGeneration, packetProvenanceComplete } from "@/domain/daily/todayMirrorAdmission";
import type { TodayIntelligence } from "@/domain/daily/todayIntelligence";
import type { TodayMirrorEvidencePacket } from "@/domain/daily/todayMirror.types";
import type {
  NormalizedCompletion,
  NormalizedReexposure,
  NormalizedRepeated,
} from "@/domain/daily/todayMirrorSignals";
import type { PilotShadowConfigResult } from "@/lib/bty/today-intelligence/pilotShadowConfig";

// ───────────────────────────── value-safe status contract ──────────────────────────

export type SignalStatus = {
  querySucceeded: boolean;
  candidateSignalEmitted: boolean;
  confidence: "none" | "low" | "medium" | "high";
  /** Machine code only (e.g. "LATENCY_NOT_SHORTER"). Never a value, count, id, or timestamp. */
  heldReason: string | null;
};

export type PilotEvidenceShadowStatus = {
  verdict: "BLOCKED_CONFIG" | "INERT_NOT_ARMED" | "ASSEMBLED" | "HOLD_NO_SIGNAL" | "HOLD_PROVENANCE";
  config: { identityConfigured: boolean; timezoneConfigured: boolean; timezoneValid: boolean };
  database: { readOnly: true; singleUserScoped: true };
  signals: {
    reexposure: SignalStatus;
    repeatedPattern: SignalStatus;
    completionInterval: SignalStatus;
    returnAfterMiss: SignalStatus;
  };
  packet: {
    assembled: boolean;
    confirmedFactsPresent: boolean;
    derivedSignalsPresent: boolean;
    evidenceReferencesResolve: boolean;
    prohibitedFieldsAbsent: boolean;
    selectedLens: string | null;
    confidence: string;
    openContractGuardActive: boolean;
  };
  returnAfterMiss: { deterministicLinkageAvailable: false; signalEmitted: false; status: "RETURN_LINKAGE_UNAVAILABLE" };
  allowedNumericClaimsEmpty: boolean;
  /** Whether the assembled evidence would be admitted for provider generation. Value-safe. */
  generationAdmission: { eligible: boolean; reason: string };
};

// ───────────────────────────── read-only user-scope enforcement ─────────────────────

export class PilotScopeError extends Error {
  constructor() {
    super("MISSING_USER_SCOPE"); // value-safe: no id, ever
    this.name = "PilotScopeError";
  }
}
export class PilotReadOnlyViolation extends Error {
  constructor(op: string) {
    super(`READ_ONLY_VIOLATION:${op}`);
    this.name = "PilotReadOnlyViolation";
  }
}

/** Every reader path funnels through this before constructing a query. Empty scope → throw. */
export function requireUserScope(userId: string): string {
  if (typeof userId !== "string" || userId.trim() === "") throw new PilotScopeError();
  return userId;
}

// ───────────────────────────── narrow read-only readers ─────────────────────────────

/** The ONLY surface the orchestrator can touch. No insert/update/upsert/delete/rpc exists here. */
export type PilotSignalReaders = {
  readCompletionsForLatency(userId: string): Promise<NormalizedCompletion[]>;
  readTopSignature(userId: string): Promise<{ reexposure: NormalizedReexposure | null; repeated: NormalizedRepeated | null }>;
  buildBrief(userId: string, now: Date): Promise<TodayIntelligence>;
};

const MUTATORS = new Set(["insert", "update", "upsert", "delete", "rpc"]);

/**
 * Wrap a Supabase client so the pilot path structurally cannot write. `.rpc` and any mutator on a
 * `.from(table)` builder throw PilotReadOnlyViolation; read chain methods pass through.
 */
export function wrapReadOnly<T extends object>(client: T): T {
  const wrapBuilder = (builder: unknown) =>
    new Proxy(builder as object, {
      get(target, prop, receiver) {
        if (typeof prop === "string" && MUTATORS.has(prop)) {
          return () => {
            throw new PilotReadOnlyViolation(prop);
          };
        }
        const v = Reflect.get(target, prop, receiver);
        return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      },
    });
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => wrapBuilder((target as unknown as SupabaseClient).from(table));
      }
      if (prop === "rpc") {
        return () => {
          throw new PilotReadOnlyViolation("rpc");
        };
      }
      const v = Reflect.get(target, prop, receiver);
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  }) as T;
}

/**
 * Build the real read-only reader bundle from a Supabase client. The client is wrapped read-only,
 * and every reader asserts an explicit user scope BEFORE any query is constructed. Used only by the
 * armed script path — never in this build arc.
 */
export function makeSupabaseReadOnlyReaders(client: SupabaseClient): PilotSignalReaders {
  const ro = wrapReadOnly(client);
  return {
    readCompletionsForLatency: (userId) => (requireUserScope(userId), readCompletionsForLatency(ro, userId)),
    readTopSignature: (userId) => (requireUserScope(userId), readTopSignature(ro, userId)),
    buildBrief: (userId, now) => (requireUserScope(userId), buildTodayIntelligence(ro, userId, now)),
  };
}

// ───────────────────────────── value-safe status derivation ─────────────────────────

/** Field names that must never leak into any packet the harness assembles. */
const PROHIBITED_KEYS = new Set([
  "text",
  "actiontext",
  "action_text",
  "content",
  "reflection",
  "letter",
  "email",
  "name",
  "fullname",
  "full_name",
  "body",
  "scenario",
  "message",
]);

function scanForProhibitedKeys(value: unknown, seen = new Set<unknown>()): boolean {
  // returns true if a prohibited key is FOUND
  if (value == null || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PROHIBITED_KEYS.has(k.toLowerCase())) return true;
    if (scanForProhibitedKeys(v, seen)) return true;
  }
  return false;
}

// Provenance resolution is the SINGLE shared invariant from the admission policy — pilot status and
// admission must never disagree, so both call packetProvenanceComplete (no local re-implementation).

function signalStatus(
  packet: TodayMirrorEvidencePacket,
  emittedCode: string,
  heldPrefix: string,
): SignalStatus {
  const querySucceeded = !packet.insufficientEvidence.includes("READ_ERROR");
  const sig = packet.derivedSignals.find((s) => s.code === emittedCode);
  const held = packet.insufficientEvidence.find((c) => c.startsWith(heldPrefix)) ?? null;
  return {
    querySucceeded,
    candidateSignalEmitted: Boolean(sig),
    confidence: sig?.confidence ?? "none",
    heldReason: sig ? null : held,
  };
}

/** Derive the value-safe status from an in-memory packet. Returns codes/booleans only. */
export function deriveShadowStatus(packet: TodayMirrorEvidencePacket): Omit<PilotEvidenceShadowStatus, "config" | "verdict"> {
  const analysis = selectMirrorLens(packet);
  const prohibitedFieldsPresent = scanForProhibitedKeys(packet);
  const admission = admitTodayMirrorGeneration(packet, analysis, { prohibitedFieldsPresent });
  return {
    database: { readOnly: true, singleUserScoped: true },
    signals: {
      reexposure: signalStatus(packet, "REEXPOSURE_CHANGED", "REEXPOSURE"),
      repeatedPattern: signalStatus(packet, "REPEATED_PATTERN", "REPEATED"),
      completionInterval: signalStatus(packet, "LATENCY_SHORTENED", "LATENCY"),
      returnAfterMiss: {
        querySucceeded: !packet.insufficientEvidence.includes("READ_ERROR"),
        candidateSignalEmitted: false,
        confidence: "none",
        heldReason: "RETURN_LINKAGE_UNAVAILABLE",
      },
    },
    packet: {
      assembled: true,
      confirmedFactsPresent: packet.confirmedFacts.length > 0,
      derivedSignalsPresent: packet.derivedSignals.length > 0,
      evidenceReferencesResolve: packetProvenanceComplete(packet),
      prohibitedFieldsAbsent: !prohibitedFieldsPresent,
      selectedLens: analysis.selectedLens,
      confidence: packet.confidence,
      openContractGuardActive: packet.openContract !== null,
    },
    returnAfterMiss: { deterministicLinkageAvailable: false, signalEmitted: false, status: "RETURN_LINKAGE_UNAVAILABLE" },
    allowedNumericClaimsEmpty: true, // V1 signals emit no numeric claims; the packet carries none
    generationAdmission: { eligible: admission.eligible, reason: admission.reason },
  };
}

function configBooleans(r: PilotShadowConfigResult): PilotEvidenceShadowStatus["config"] {
  if (r.ok) return { identityConfigured: true, timezoneConfigured: true, timezoneValid: true };
  switch (r.reason) {
    case "PILOT_ID_MISSING":
    case "PILOT_ID_INVALID":
      return { identityConfigured: false, timezoneConfigured: false, timezoneValid: false };
    case "PILOT_TIMEZONE_MISSING":
      return { identityConfigured: true, timezoneConfigured: false, timezoneValid: false };
    case "PILOT_TIMEZONE_INVALID":
      return { identityConfigured: true, timezoneConfigured: true, timezoneValid: false };
  }
}

const EMPTY_SIGNAL: SignalStatus = { querySucceeded: false, candidateSignalEmitted: false, confidence: "none", heldReason: null };

function inertStatus(
  config: PilotEvidenceShadowStatus["config"],
  verdict: "BLOCKED_CONFIG" | "INERT_NOT_ARMED",
): PilotEvidenceShadowStatus {
  return {
    verdict,
    config,
    database: { readOnly: true, singleUserScoped: true },
    signals: {
      reexposure: EMPTY_SIGNAL,
      repeatedPattern: EMPTY_SIGNAL,
      completionInterval: EMPTY_SIGNAL,
      returnAfterMiss: { ...EMPTY_SIGNAL, heldReason: "RETURN_LINKAGE_UNAVAILABLE" },
    },
    packet: {
      assembled: false,
      confirmedFactsPresent: false,
      derivedSignalsPresent: false,
      evidenceReferencesResolve: false,
      prohibitedFieldsAbsent: true,
      selectedLens: null,
      confidence: "none",
      openContractGuardActive: false,
    },
    returnAfterMiss: { deterministicLinkageAvailable: false, signalEmitted: false, status: "RETURN_LINKAGE_UNAVAILABLE" },
    allowedNumericClaimsEmpty: true,
    // No packet assembled → nothing admissible for provider generation.
    generationAdmission: { eligible: false, reason: "INSUFFICIENT_EVIDENCE" },
  };
}

/**
 * A client the assembler must never touch on the pilot path. If the assembler were ever to issue a
 * query (it won't — inputs + brief are injected), this throws and fails SOFT to READ_ERROR.
 */
const FORBIDDEN_CLIENT = new Proxy(
  {},
  {
    get() {
      throw new PilotReadOnlyViolation("assembler-must-not-query");
    },
  },
) as unknown as SupabaseClient;

// ───────────────────────────── orchestrator ────────────────────────────────────────

export type RunPilotShadowOptions = {
  config: PilotShadowConfigResult;
  now: Date;
  /** Both env arm + CLI flag present. When false, NO reader runs and NO packet is assembled. */
  armed: boolean;
  /** Required only when armed. Synthetic in tests; Supabase-backed read-only in the armed script. */
  readers?: PilotSignalReaders;
};

/**
 * Run the pilot evidence shadow. Returns value-safe status ONLY. The assembled packet is created
 * in memory (armed path), read for status, then discarded — never returned, logged, or serialized.
 */
export async function runPilotEvidenceShadow(opts: RunPilotShadowOptions): Promise<PilotEvidenceShadowStatus> {
  const config = configBooleans(opts.config);

  if (!opts.config.ok) return inertStatus(config, "BLOCKED_CONFIG");
  if (!opts.armed || !opts.readers) return inertStatus(config, "INERT_NOT_ARMED");

  const { userId, timezone } = opts.config.config;
  const scoped = requireUserScope(userId);
  const readers = opts.readers;

  // Read (read-only, single-user scoped). Each reader receives the SAME explicit id.
  const [completions, sig, brief] = await Promise.all([
    readers.readCompletionsForLatency(scoped),
    readers.readTopSignature(scoped),
    readers.buildBrief(scoped, opts.now),
  ]);

  // Assemble in memory with the CONFIGURED timezone and the injected brief → zero client calls.
  const packet = await assembleTodayMirrorPacket(
    FORBIDDEN_CLIENT,
    scoped,
    opts.now,
    { completions, reexposure: sig.reexposure, repeated: sig.repeated },
    { timezone, brief },
  );

  const body = deriveShadowStatus(packet);
  const emitted =
    body.signals.reexposure.candidateSignalEmitted ||
    body.signals.repeatedPattern.candidateSignalEmitted ||
    body.signals.completionInterval.candidateSignalEmitted ||
    body.packet.openContractGuardActive;
  const verdict: PilotEvidenceShadowStatus["verdict"] = packet.insufficientEvidence.includes("READ_ERROR")
    ? "HOLD_PROVENANCE"
    : emitted
      ? "ASSEMBLED"
      : "HOLD_NO_SIGNAL";

  // `packet` goes out of scope here; only `body` (value-safe) is returned.
  return { verdict, config, ...body };
}
