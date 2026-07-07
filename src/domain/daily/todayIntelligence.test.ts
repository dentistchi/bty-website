import { describe, it, expect } from "vitest";
import { deriveTodayIntelligence } from "@/domain/daily/todayIntelligence";
import {
  axisToRelationship,
  resolveRelationship,
  normalizeAxisToken,
  AXIS_RELATIONSHIP_LOOKUP_V1,
} from "@/domain/daily/axisRelationship";

describe("axis normalization + lookup v1.1", () => {
  it("1. case + whitespace: Ownership / ' ownership ' → Others", () => {
    expect(axisToRelationship("Ownership")).toBe("Others");
    expect(axisToRelationship(" ownership ")).toBe("Others");
    expect(normalizeAxisToken("Ownership")).toBe("ownership");
    expect(normalizeAxisToken(" ownership ")).toBe("ownership");
  });

  it("2. reputation (v1.1) → Others; visibility stays World", () => {
    expect(axisToRelationship("Reputation")).toBe("Others");
    expect(axisToRelationship("reputation")).toBe("Others");
    expect(AXIS_RELATIONSHIP_LOOKUP_V1.reputation).toBe("Others");
    expect(AXIS_RELATIONSHIP_LOOKUP_V1.visibility).toBe("World");
  });

  it("separator folding: Courage/Risk & courage-risk → courage_risk → Self", () => {
    expect(normalizeAxisToken("Courage/Risk")).toBe("courage_risk");
    expect(normalizeAxisToken("courage-risk")).toBe("courage_risk");
    expect(axisToRelationship("Courage/Risk")).toBe("Self");
  });

  it("3. unknown stays null — never guessed", () => {
    expect(axisToRelationship("UnmappedThing")).toBeNull();
    expect(axisToRelationship("multi")).toBeNull();
    expect(axisToRelationship("")).toBeNull();
    expect(resolveRelationship({ axis: "UnmappedThing", patternFamily: null })).toBeNull();
  });
});

describe("resolveRelationship — axis primary / family fallback (STEP 7L)", () => {
  it("4. axis wins over pattern_family: Ownership + truth_naming → Others via axis", () => {
    const r = resolveRelationship({ axis: "Ownership", patternFamily: "truth_naming" });
    expect(r).toEqual({ relationship: "Others", source: "axis" });
  });

  it("5. family fallback only when axis absent/unknown: null axis + truth_naming → World via family", () => {
    const r = resolveRelationship({ axis: null, patternFamily: "truth_naming" });
    expect(r).toEqual({ relationship: "World", source: "pattern_family_fallback" });
    // unknown axis token also falls through to family
    const r2 = resolveRelationship({ axis: "UnmappedThing", patternFamily: "repair_avoidance" });
    expect(r2).toEqual({ relationship: "Others", source: "pattern_family_fallback" });
  });
});

describe("deriveTodayIntelligence — same-window ladder (STEP 7L)", () => {
  const YM = "YESTERDAY_MIRROR" as const;

  it("6. scans past a null first row → returns first derivable (rows[0] not the stopper)", () => {
    const out = deriveTodayIntelligence({
      gate: YM,
      staleCandidates: [
        { axis: "UnmappedThing", patternFamily: null }, // unknown → skip
        { axis: "Ownership", patternFamily: null }, // derivable
      ],
    });
    expect(out.relationshipFocus).toBe("Others");
    expect(out.confidence).toBe("low");
  });

  it("7. same-window evidence beats a stale signature (high/medium, not none)", () => {
    const out = deriveTodayIntelligence({
      gate: YM,
      windowCandidates: [{ tier: "verified_action", axis: null, patternFamily: "ownership_escape" }],
      staleCandidates: [{ axis: "truth", patternFamily: null }], // would be World, but window wins
    });
    expect(out.relationshipFocus).toBe("Others"); // from ownership_escape → ownership
    expect(out.confidence).toBe("high");
    expect(out.fallbackMode).toBe("none");
    expect(out.reasonCodes).toContain("WINDOW_VERIFIED_ACTION");
  });

  it("window scenario signal → medium", () => {
    const out = deriveTodayIntelligence({
      gate: YM,
      windowCandidates: [{ tier: "scenario_signal", axis: null, patternFamily: "future_deferral" }],
    });
    expect(out.relationshipFocus).toBe("Self"); // future_deferral → time → Self
    expect(out.confidence).toBe("medium");
  });

  it("8. stale signature fallback is downgraded to low (Ownership → Others)", () => {
    const out = deriveTodayIntelligence({
      gate: YM,
      windowCandidates: [],
      staleCandidates: [{ axis: "Ownership", patternFamily: null }],
    });
    expect(out.relationshipFocus).toBe("Others");
    expect(out.confidence).toBe("low");
    expect(out.reasonCodes).toContain("STALE_SIGNATURE");
  });

  it("9. no derivable evidence → confidence none, unknown_axis (neutral fallback)", () => {
    const noCandidates = deriveTodayIntelligence({ gate: YM });
    expect(noCandidates.confidence).toBe("none");
    expect(noCandidates.fallbackMode).toBe("unknown_axis");
    expect(noCandidates.reasonCodes).toContain("NO_AXIS_SIGNAL");

    const allUnknown = deriveTodayIntelligence({
      gate: YM,
      windowCandidates: [{ tier: "pending_action", axis: "nope", patternFamily: "nope" }],
      staleCandidates: [{ axis: "multi", patternFamily: null }],
    });
    expect(allUnknown.confidence).toBe("none");
    expect(allUnknown.reasonCodes).toContain("AXIS_UNKNOWN");
  });
});

describe("deriveTodayIntelligence — gate ladder unchanged", () => {
  it("read failure → clean-start read_error", () => {
    const out = deriveTodayIntelligence({ gate: "OPEN_DAY", readError: true });
    expect(out.relationshipFocus).toBe("CleanStart");
    expect(out.fallbackMode).toBe("read_error");
  });

  it("blocking gates → ContinuePending", () => {
    expect(deriveTodayIntelligence({ gate: "FORCED_RESET" }).relationshipFocus).toBe("ContinuePending");
    expect(
      deriveTodayIntelligence({ gate: "ACTION_REQUIRED", blockingContractStatus: "submitted" }).reasonCodes,
    ).toContain("ACTION_AWAITING_VERIFICATION");
    expect(deriveTodayIntelligence({ gate: "REEXPOSURE_DUE" }).relationshipFocus).toBe("ContinuePending");
  });

  it("clean gates → CleanStart / no_evidence", () => {
    expect(deriveTodayIntelligence({ gate: "FIRST_DAY" }).userState).toBe("new_user");
    expect(deriveTodayIntelligence({ gate: "QUIET_INVITATION" }).userState).toBe(
      "returning_no_yesterday_activity",
    );
    expect(deriveTodayIntelligence({ gate: "OPEN_DAY" }).fallbackMode).toBe("no_evidence");
  });
});
