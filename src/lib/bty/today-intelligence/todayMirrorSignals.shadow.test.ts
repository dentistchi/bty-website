import { describe, it, expect } from "vitest";
import { assembleTodayMirrorPacket } from "@/lib/bty/today-intelligence/todayMirrorEvidence.server";
import { generateTodayMirror } from "@/lib/bty/today-intelligence/todayMirrorGenerate";
import { makeMockMirrorClient } from "@/lib/bty/today-intelligence/__fixtures__/todayMirrorFixtures";
import { EMPTY_RECENT_CONTEXT } from "@/domain/daily/todayMirror.types";

// Mock supabase → buildTodayIntelligence degrades to a clean READ_ERROR brief (no context),
// so ONLY the injected new-signal inputs drive the packet. No production DB.
const mockDb = { from() { throw new Error("no db in shadow"); } } as never;
const NOW = new Date("2026-07-10T06:00:00Z");
const gen = (packet: Awaited<ReturnType<typeof assembleTodayMirrorPacket>>) =>
  generateTodayMirror({ packet, recent: EMPTY_RECENT_CONTEXT, locale: "en", client: makeMockMirrorClient() });

describe("synthetic-adapter shadow: new signals → lens + clean generation", () => {
  it("reexposure_changed → reexposure_change lens, floor-clean", async () => {
    const packet = await assembleTodayMirrorPacket(mockDb, "u1", NOW, {
      reexposure: { signatureId: "s1", patternFamily: "repair_avoidance", axis: "repair", repeatCount: 3, lastValidationResult: "changed", confidenceScore: 0.8, lastSeenAt: "2026-07-09T12:00:00Z", relationship: "Others" },
    });
    expect(packet.derivedSignals.map((s) => s.code)).toContain("REEXPOSURE_CHANGED");
    const res = await gen(packet);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.response.lens).toBe("reexposure_change");
  });

  it("completion latency (same family, shorter) → completion_latency lens", async () => {
    const packet = await assembleTodayMirrorPacket(mockDb, "u1", NOW, {
      completions: [
        { id: "p", patternFamily: "future_deferral", chosenAt: "2026-07-08T10:00:00Z", verifiedAt: "2026-07-08T14:00:00Z", userId: "u1" },
        { id: "c", patternFamily: "future_deferral", chosenAt: "2026-07-09T10:00:00Z", verifiedAt: "2026-07-09T11:00:00Z", userId: "u1" },
      ],
    });
    expect(packet.derivedSignals.map((s) => s.code)).toContain("LATENCY_SHORTENED");
    const res = await gen(packet);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.response.lens).toBe("completion_latency");
  });

  it("repeated (summary scalar) → repeated_pattern lens (low)", async () => {
    const packet = await assembleTodayMirrorPacket(mockDb, "u1", NOW, {
      repeated: { patternKey: "self_protection", patternFamily: "self_protection", repeatCount: 3, consecutiveCount: null, totalCount: null, familyWindowTally: null, lastSeenAt: "2026-07-09T12:00:00Z", relationship: "Self" },
    });
    expect(packet.derivedSignals.map((s) => s.code)).toContain("REPEATED_PATTERN");
    const res = await gen(packet);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.response.lens).toBe("repeated_pattern");
  });

  it("changed re-exposure outranks a coincident repeated pattern", async () => {
    const packet = await assembleTodayMirrorPacket(mockDb, "u1", NOW, {
      reexposure: { signatureId: "s1", patternFamily: "repair_avoidance", axis: "repair", repeatCount: 3, lastValidationResult: "changed", confidenceScore: 0.9, lastSeenAt: "2026-07-09T12:00:00Z", relationship: "Others" },
      repeated: { patternKey: "self_protection", patternFamily: "self_protection", repeatCount: 4, consecutiveCount: null, totalCount: null, familyWindowTally: null, lastSeenAt: "2026-07-09T12:00:00Z", relationship: "Self" },
    });
    const res = await gen(packet);
    expect(res.ok && res.response.lens).toBe("reexposure_change");
  });

  it("no supportable signal → insufficient (restraint)", async () => {
    const packet = await assembleTodayMirrorPacket(mockDb, "u1", NOW, {
      completions: [{ id: "only", patternFamily: "x", chosenAt: "2026-07-09T10:00:00Z", verifiedAt: "2026-07-09T11:00:00Z", userId: "u1" }],
      reexposure: { signatureId: "s", patternFamily: "y", axis: "a", repeatCount: 1, lastValidationResult: "no_change", confidenceScore: 0.2, lastSeenAt: "2026-07-09T12:00:00Z" },
    });
    expect(packet.confidence).toBe("none");
    expect(packet.derivedSignals).toEqual([]);
  });
});
