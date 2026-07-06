import { describe, it, expect } from "vitest";
import { deriveTodayIntelligence } from "@/domain/daily/todayIntelligence";
import { axisToRelationship, AXIS_RELATIONSHIP_LOOKUP_V1 } from "@/domain/daily/axisRelationship";

describe("axisToRelationship (Commander lookup v1)", () => {
  it("maps direct axis tokens per lock", () => {
    expect(axisToRelationship("ownership")).toBe("Others");
    expect(axisToRelationship("time")).toBe("Self");
    expect(axisToRelationship("truth")).toBe("World");
    expect(axisToRelationship("control")).toBe("World");
    expect(axisToRelationship("courage_risk")).toBe("Self");
  });

  it("resolves a stored pattern-family id to its axis relationship", () => {
    expect(axisToRelationship("ownership_escape")).toBe("Others");
    expect(axisToRelationship("future_deferral")).toBe("Self");
    expect(axisToRelationship("truth_naming")).toBe("World");
    // alias family → canonical → axis
    expect(axisToRelationship("reality_distortion")).toBe("World");
  });

  it("never guesses: unknown / multi / empty → null", () => {
    expect(axisToRelationship("unknown")).toBeNull();
    expect(axisToRelationship("multi")).toBeNull();
    expect(axisToRelationship("")).toBeNull();
    expect(axisToRelationship(null)).toBeNull();
    expect(axisToRelationship("something_unmapped")).toBeNull();
  });

  it("every lookup value is one of the three product relationships", () => {
    for (const rel of Object.values(AXIS_RELATIONSHIP_LOOKUP_V1)) {
      expect(["Self", "Others", "World"]).toContain(rel);
    }
  });
});

describe("deriveTodayIntelligence (STEP 7B ladder)", () => {
  it("read failure → clean start, read_error, never white-screens", () => {
    const out = deriveTodayIntelligence({ gate: "OPEN_DAY", readError: true });
    expect(out.relationshipFocus).toBe("CleanStart");
    expect(out.fallbackMode).toBe("read_error");
    expect(out.confidence).toBe("none");
  });

  it("pending action → ContinuePending (continuity preserved)", () => {
    const out = deriveTodayIntelligence({ gate: "ACTION_REQUIRED", blockingContractStatus: "pending" });
    expect(out.relationshipFocus).toBe("ContinuePending");
    expect(out.reasonCodes).toContain("PENDING_ACTION");
    expect(out.confidence).toBe("high");
  });

  it("submitted action → awaiting verification continuity", () => {
    const out = deriveTodayIntelligence({ gate: "ACTION_REQUIRED", blockingContractStatus: "submitted" });
    expect(out.relationshipFocus).toBe("ContinuePending");
    expect(out.reasonCodes).toContain("ACTION_AWAITING_VERIFICATION");
  });

  it("forced reset and re-exposure → ContinuePending", () => {
    expect(deriveTodayIntelligence({ gate: "FORCED_RESET" }).relationshipFocus).toBe("ContinuePending");
    expect(deriveTodayIntelligence({ gate: "REEXPOSURE_DUE" }).relationshipFocus).toBe("ContinuePending");
  });

  it("yesterday evidence + mapped axis → relationship focus (yesterday=high)", () => {
    const out = deriveTodayIntelligence({
      gate: "YESTERDAY_MIRROR",
      recentAxis: { axis: "repair", recency: "yesterday" },
    });
    expect(out.relationshipFocus).toBe("Others");
    expect(out.confidence).toBe("high");
    expect(out.reasonCodes).toContain("YESTERDAY_EVIDENCE");
    expect(out.reasonCodes).toContain("AXIS_MAPPED_repair");
    expect(out.fallbackMode).toBe("none");
  });

  it("yesterday evidence + windowed axis → medium confidence", () => {
    const out = deriveTodayIntelligence({
      gate: "YESTERDAY_MIRROR",
      recentAxis: { axis: "integrity", recency: "window" },
    });
    expect(out.relationshipFocus).toBe("Self");
    expect(out.confidence).toBe("medium");
  });

  it("yesterday evidence + unknown/absent axis → unknown_axis, no claim", () => {
    const noAxis = deriveTodayIntelligence({ gate: "YESTERDAY_MIRROR", recentAxis: null });
    expect(noAxis.fallbackMode).toBe("unknown_axis");
    expect(noAxis.confidence).toBe("none");
    expect(noAxis.reasonCodes).toContain("NO_AXIS_SIGNAL");

    const badAxis = deriveTodayIntelligence({
      gate: "YESTERDAY_MIRROR",
      recentAxis: { axis: "multi", recency: "yesterday" },
    });
    expect(badAxis.fallbackMode).toBe("unknown_axis");
    expect(badAxis.reasonCodes).toContain("AXIS_UNKNOWN");
  });

  it("first day / quiet invitation / open day → clean start, no fake continuity", () => {
    expect(deriveTodayIntelligence({ gate: "FIRST_DAY" }).userState).toBe("new_user");
    expect(deriveTodayIntelligence({ gate: "QUIET_INVITATION" }).userState).toBe(
      "returning_no_yesterday_activity",
    );
    const open = deriveTodayIntelligence({ gate: "OPEN_DAY" });
    expect(open.relationshipFocus).toBe("CleanStart");
    expect(open.fallbackMode).toBe("no_evidence");
  });
});
