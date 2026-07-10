/**
 * Pilot shadow — SIGNALS value-safe status (matrix §12: SIGNALS 29–35). Synthetic, no DB.
 */
import { describe, it, expect } from "vitest";
import { runPilotEvidenceShadow } from "@/lib/bty/today-intelligence/pilotShadow";
import type { TodayIntelligence } from "@/domain/daily/todayIntelligence";
import {
  okConfig,
  makeFakeReaders,
  shorterLatencyCompletions,
  REEXPOSURE_CHANGED,
} from "@/lib/bty/today-intelligence/__fixtures__/pilotShadowFixtures";

const NOW = new Date("2026-07-10T06:00:00Z");
const run = (inputs: Parameters<typeof makeFakeReaders>[0]) =>
  runPilotEvidenceShadow({ config: okConfig(), now: NOW, armed: true, readers: makeFakeReaders(inputs).readers });

describe("pilot signal value-safe status", () => {
  it("29. reexposure → value-safe status (emitted, high, no held reason)", async () => {
    const s = await run({ reexposure: REEXPOSURE_CHANGED });
    expect(s.signals.reexposure).toEqual({ querySucceeded: true, candidateSignalEmitted: true, confidence: "high", heldReason: null });
    expect(s.verdict).toBe("ASSEMBLED");
    expect(s.packet.selectedLens).toBe("reexposure_change");
  });

  it("30. repeated-pattern → value-safe status (summary scalar → emitted, low)", async () => {
    const s = await run({
      repeated: { patternKey: "self_protection", patternFamily: "self_protection", repeatCount: 3, consecutiveCount: null, totalCount: null, familyWindowTally: null, lastSeenAt: "2026-07-09T12:00:00Z", relationship: "Self" },
    });
    expect(s.signals.repeatedPattern.candidateSignalEmitted).toBe(true);
    expect(s.signals.repeatedPattern.confidence).toBe("low");
    expect(s.signals.repeatedPattern.heldReason).toBeNull();
  });

  it("31. completion-interval → value-safe status (shorter same-family → emitted, medium)", async () => {
    const s = await run({ completions: shorterLatencyCompletions() });
    expect(s.signals.completionInterval.candidateSignalEmitted).toBe(true);
    expect(s.signals.completionInterval.confidence).toBe("medium");
    expect(s.packet.selectedLens).toBe("completion_latency");
  });

  it("32. return-after-miss is held (never emitted)", async () => {
    const s = await run({ reexposure: REEXPOSURE_CHANGED });
    expect(s.signals.returnAfterMiss.candidateSignalEmitted).toBe(false);
    expect(s.signals.returnAfterMiss.heldReason).toBe("RETURN_LINKAGE_UNAVAILABLE");
    expect(s.returnAfterMiss).toEqual({ deterministicLinkageAvailable: false, signalEmitted: false, status: "RETURN_LINKAGE_UNAVAILABLE" });
  });

  it("33. no qualifying signal is a VALID result (HOLD_NO_SIGNAL, not error)", async () => {
    const s = await run({}); // empty inputs, clean brief
    expect(s.verdict).toBe("HOLD_NO_SIGNAL");
    expect(s.packet.assembled).toBe(true);
    expect(s.packet.confidence).toBe("none");
    expect(s.signals.reexposure.candidateSignalEmitted).toBe(false);
    expect(s.signals.completionInterval.candidateSignalEmitted).toBe(false);
    expect(s.signals.completionInterval.querySucceeded).toBe(true); // read ran; just nothing to claim
  });

  it("34. provenance failure returns a status-only HOLD (HOLD_PROVENANCE)", async () => {
    const readErrorBrief: TodayIntelligence = { userState: "safe_fallback", relationshipFocus: "CleanStart", confidence: "none", reasonCodes: ["READ_ERROR"], fallbackMode: "read_error" };
    const s = await run({ brief: readErrorBrief });
    expect(s.verdict).toBe("HOLD_PROVENANCE");
    expect(s.signals.completionInterval.querySucceeded).toBe(false);
    expect(s).not.toHaveProperty("confirmedFacts"); // still status-only
  });

  it("35. allowedNumericClaims remains empty across every signal outcome", async () => {
    for (const inputs of [{ reexposure: REEXPOSURE_CHANGED }, { completions: shorterLatencyCompletions() }, {}]) {
      const s = await run(inputs);
      expect(s.allowedNumericClaimsEmpty).toBe(true);
    }
  });
});
