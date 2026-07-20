import { describe, it, expect } from "vitest";
import { resolveCanonicalLeaderStatus, RESPONSIBILITY_KEYS } from "./orgResponsibilities";

/**
 * Slice 3.1B-2 — THE canonical leader definition. Leader status comes from active
 * canonical leadership responsibilities and from nothing else. These tests pin the
 * negative space especially hard: every legacy leader-ish signal in the product must be
 * incapable of producing leader=true.
 */

describe("resolveCanonicalLeaderStatus — qualifying", () => {
  it.each(["PARTNER", "CLINICAL_DIRECTOR", "TRAINER", "TEAM_LEAD", "PEOPLE_MANAGER"])(
    "%s alone qualifies",
    (key) => {
      const r = resolveCanonicalLeaderStatus({ activeResponsibilityKeys: [key] });
      expect(r.isLeader).toBe(true);
      expect(r.matchedResponsibilityKeys).toEqual([key]);
    },
  );

  it("covers the entire canonical vocabulary (no key is silently non-qualifying)", () => {
    for (const key of RESPONSIBILITY_KEYS) {
      expect(resolveCanonicalLeaderStatus({ activeResponsibilityKeys: [key] }).isLeader).toBe(true);
    }
  });

  it("Hanbit Chi's real live set (PARTNER + CLINICAL_DIRECTOR + PEOPLE_MANAGER) qualifies", () => {
    const r = resolveCanonicalLeaderStatus({
      activeResponsibilityKeys: ["PARTNER", "CLINICAL_DIRECTOR", "PEOPLE_MANAGER"],
    });
    expect(r.isLeader).toBe(true);
    expect(r.matchedResponsibilityKeys).toEqual(["PARTNER", "CLINICAL_DIRECTOR", "PEOPLE_MANAGER"]);
  });

  it("multiple qualifying responsibilities still describe ONE member (no duplication)", () => {
    const r = resolveCanonicalLeaderStatus({
      activeResponsibilityKeys: ["PARTNER", "PARTNER", "TRAINER"],
    });
    expect(r.isLeader).toBe(true);
    // deduplicated — a member is never counted twice for holding two responsibilities
    expect(r.matchedResponsibilityKeys).toEqual(["PARTNER", "TRAINER"]);
  });
});

describe("resolveCanonicalLeaderStatus — NOT qualifying", () => {
  it("zero active responsibilities does not qualify", () => {
    const r = resolveCanonicalLeaderStatus({ activeResponsibilityKeys: [] });
    expect(r.isLeader).toBe(false);
    expect(r.matchedResponsibilityKeys).toEqual([]);
  });

  it("no legacy leader signal can produce leader=true", () => {
    // Every one of these is a real field in the product. None is authoritative here.
    const legacySignals = [
      "GENERAL_DENTIST", // primary role alone
      "CLINICAL_PROVIDER", // job family alone
      "is_leader_track",
      "leader_started_at",
      "is_lead", // office_assignments.is_lead
      "leader", // legacy job_function
      "staff",
      "CERTIFIED_LEADER", // certified_leader_grants
      "LEAD", // the pre-rename key that was never adopted
    ];
    for (const signal of legacySignals) {
      const r = resolveCanonicalLeaderStatus({ activeResponsibilityKeys: [signal] });
      expect(r.isLeader, `${signal} must not qualify`).toBe(false);
      expect(r.matchedResponsibilityKeys).toEqual([]);
    }
  });

  it("an entire bundle of legacy signals together still does not qualify", () => {
    const r = resolveCanonicalLeaderStatus({
      activeResponsibilityKeys: ["is_leader_track", "leader", "is_lead", "GENERAL_DENTIST"],
    });
    expect(r.isLeader).toBe(false);
  });

  it("ignores unrecognized keys but still honours a real one alongside them", () => {
    const r = resolveCanonicalLeaderStatus({
      activeResponsibilityKeys: ["is_leader_track", "PARTNER", "junk"],
    });
    expect(r.isLeader).toBe(true);
    expect(r.matchedResponsibilityKeys).toEqual(["PARTNER"]);
  });

  it("is case-sensitive — lowercase canonical keys are not accepted", () => {
    expect(resolveCanonicalLeaderStatus({ activeResponsibilityKeys: ["partner"] }).isLeader).toBe(false);
  });
});
