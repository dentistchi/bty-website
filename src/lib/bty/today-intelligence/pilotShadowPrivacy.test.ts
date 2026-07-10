/**
 * Pilot shadow — PRIVACY / no-serialization (matrix §12: PRIVACY 18–24). Synthetic sentinels only.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  runPilotEvidenceShadow,
  deriveShadowStatus,
  PilotScopeError,
  PilotReadOnlyViolation,
} from "@/lib/bty/today-intelligence/pilotShadow";
import type { NormalizedReexposure } from "@/domain/daily/todayMirrorSignals";
import type { TodayMirrorEvidencePacket } from "@/domain/daily/todayMirror.types";
import { okConfig, makeFakeReaders, SYNTH_USER_ID } from "@/lib/bty/today-intelligence/__fixtures__/pilotShadowFixtures";

const NOW = new Date("2026-07-10T18:00:00Z");
const RECORD_SENTINEL = "SENTINEL_RECORD_ID_zzz";
const TEXT_SENTINEL = "SENTINEL_REFLECTION_TEXT_zzz";
const TS_SENTINEL = "2026-07-09T12:34:56Z";

/** Reexposure carrying private sentinels in id, timestamp, and a rogue raw-text field. */
const sentinelReexposure = {
  signatureId: RECORD_SENTINEL,
  patternFamily: "repair_avoidance",
  axis: "repair",
  repeatCount: 3,
  lastValidationResult: "changed",
  confidenceScore: 0.9,
  lastSeenAt: TS_SENTINEL,
  relationship: "Others",
  priorEventId: "e-prior",
  laterEventId: "e-later",
  // rogue field that MUST be stripped by the adapters (not part of the type):
  reflection: TEXT_SENTINEL,
} as unknown as NormalizedReexposure;

async function statusWithSentinels() {
  const { readers } = makeFakeReaders({ reexposure: sentinelReexposure });
  return runPilotEvidenceShadow({ config: okConfig(), now: NOW, armed: true, readers });
}

describe("pilot privacy / no-serialization", () => {
  it("18. the raw packet is never returned (status carries only value-safe shape)", async () => {
    const status = await statusWithSentinels();
    expect(status).not.toHaveProperty("confirmedFacts");
    expect(status).not.toHaveProperty("derivedSignals");
    expect(status).not.toHaveProperty("openContract");
    expect(Object.keys(status.packet).sort()).toEqual(
      [
        "assembled",
        "confidence",
        "confirmedFactsPresent",
        "derivedSignalsPresent",
        "evidenceReferencesResolve",
        "openContractGuardActive",
        "prohibitedFieldsAbsent",
        "selectedLens",
      ].sort(),
    );
    // The signal still resolved (proves we DID assemble), yet nothing raw leaks.
    expect(status.signals.reexposure.candidateSignalEmitted).toBe(true);
  });

  it("19. user ID is absent from the status", async () => {
    const status = await statusWithSentinels();
    expect(JSON.stringify(status)).not.toContain(SYNTH_USER_ID);
  });

  it("20. record IDs are absent from the status", async () => {
    const status = await statusWithSentinels();
    expect(JSON.stringify(status)).not.toContain(RECORD_SENTINEL);
  });

  it("21. timestamps and durations are absent from the status", async () => {
    const status = await statusWithSentinels();
    const json = JSON.stringify(status);
    expect(json).not.toContain(TS_SENTINEL);
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/); // no ISO instant anywhere
  });

  it("22. raw action/scenario/reflection text is absent; prohibitedFieldsAbsent holds", async () => {
    const status = await statusWithSentinels();
    expect(JSON.stringify(status)).not.toContain(TEXT_SENTINEL);
    expect(status.packet.prohibitedFieldsAbsent).toBe(true);
    // And the scanner DOES flag a packet that carries a prohibited field (guard is real, not vacuous).
    const dirty = { confirmedFacts: [{ id: "x", reflection: TEXT_SENTINEL }], derivedSignals: [], openContract: null, insufficientEvidence: [], prohibitedClaims: [], allowedLenses: [], confidence: "low", userDay: { date: "2026-07-10", timezone: "UTC", boundaryHour: 5 } } as unknown as TodayMirrorEvidencePacket;
    expect(deriveShadowStatus(dirty).packet.prohibitedFieldsAbsent).toBe(false);
  });

  it("23. error output is value-safe (no injected value in error messages)", () => {
    const scope = new PilotScopeError();
    expect(scope.message).toBe("MISSING_USER_SCOPE");
    expect(scope.message).not.toContain(SYNTH_USER_ID);
    const ro = new PilotReadOnlyViolation("insert");
    expect(ro.message).toBe("READ_ONLY_VIOLATION:insert");
    expect(ro.message).not.toContain(RECORD_SENTINEL);
  });

  it("24. no file / artifact writer is called during a shadow run", async () => {
    // (a) The orchestrator emits nothing to the console during a run.
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await statusWithSentinels();
    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
    errSpy.mockRestore();
    // (b) The orchestrator module imports no filesystem writer at all.
    const src = readFileSync("src/lib/bty/today-intelligence/pilotShadow.ts", "utf8");
    for (const w of ["writeFileSync", "appendFileSync", "createWriteStream", "node:fs", '"fs"']) {
      expect(src).not.toContain(w);
    }
  });
});
