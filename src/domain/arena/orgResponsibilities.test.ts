import { describe, it, expect } from "vitest";
import {
  RESPONSIBILITY_KEYS,
  isResponsibilityKey,
  isResponsibilityAction,
  isCalendarDateString,
  responsibilityStartDateError,
  validateResponsibilityMutation,
} from "./orgResponsibilities";

/**
 * Slice 3.1B-1 domain (pure). Proves the responsibility vocabulary is closed, that unknown
 * dates stay unknown, that a future date is impossible, and — critically — that NO legacy
 * leader signal is part of this taxonomy.
 */
const TODAY = "2026-07-20";

describe("responsibility vocabulary", () => {
  it("is exactly the five canonical keys", () => {
    expect([...RESPONSIBILITY_KEYS]).toEqual([
      "PARTNER",
      "CLINICAL_DIRECTOR",
      "TRAINER",
      "TEAM_LEAD",
      "PEOPLE_MANAGER",
    ]);
  });

  it("namespaces TEAM_LEAD so it can never collide with the authz flag office_assignments.is_lead", () => {
    expect(isResponsibilityKey("TEAM_LEAD")).toBe(true);
    // the bare `LEAD` key is deliberately NOT canonical
    expect(isResponsibilityKey("LEAD")).toBe(false);
    expect(isResponsibilityKey("is_lead")).toBe(false);
  });

  it("rejects every non-canonical key, including legacy leader signals (never inferred)", () => {
    for (const bad of [
      "leader",
      "staff",
      "LEADER",
      "is_leader_track",
      "leader_started_at",
      "job_function",
      "CERTIFIED_LEADER",
      "GENERAL_DENTIST", // a primary role is not a responsibility
      "",
      null,
      undefined,
      42,
    ]) {
      expect(isResponsibilityKey(bad)).toBe(false);
    }
  });

  it("does not overlap the primary-role taxonomy", () => {
    for (const k of RESPONSIBILITY_KEYS) {
      expect(k).not.toBe("GENERAL_DENTIST");
      expect(k).not.toBe("OFFICE_MANAGER");
    }
  });
});

describe("responsibility actions", () => {
  it("accepts exactly assign / revise_date / remove", () => {
    expect(isResponsibilityAction("assign")).toBe(true);
    expect(isResponsibilityAction("revise_date")).toBe(true);
    expect(isResponsibilityAction("remove")).toBe(true);
    expect(isResponsibilityAction("delete")).toBe(false);
    expect(isResponsibilityAction("")).toBe(false);
  });
});

describe("start date rule", () => {
  it("treats NULL as unknown and leaves it unknown", () => {
    expect(responsibilityStartDateError(null, TODAY)).toBeNull();
  });

  it("accepts a past or today date", () => {
    expect(responsibilityStartDateError("2013-01-01", TODAY)).toBeNull();
    expect(responsibilityStartDateError(TODAY, TODAY)).toBeNull();
  });

  it("rejects a future date", () => {
    expect(responsibilityStartDateError("2026-07-21", TODAY)).toBe("start_date_in_future");
  });

  it("rejects malformed and impossible calendar dates", () => {
    expect(isCalendarDateString("2025-02-30")).toBe(false);
    expect(isCalendarDateString("2025-13-01")).toBe(false);
    expect(isCalendarDateString("20250101")).toBe(false);
    expect(isCalendarDateString("2025-01-01T00:00:00Z")).toBe(false);
    expect(responsibilityStartDateError("not-a-date", TODAY)).toBe("start_date_not_a_date");
  });
});

describe("validateResponsibilityMutation", () => {
  it("accepts a valid assign with a known date", () => {
    expect(
      validateResponsibilityMutation(
        { responsibilityKey: "PARTNER", action: "assign", startedOn: "2020-01-01" },
        TODAY,
      ),
    ).toEqual({ ok: true });
  });

  it("accepts a valid assign with an unknown (null) date", () => {
    expect(
      validateResponsibilityMutation(
        { responsibilityKey: "CLINICAL_DIRECTOR", action: "assign", startedOn: null },
        TODAY,
      ),
    ).toEqual({ ok: true });
  });

  it("rejects an invalid key BEFORE any date reasoning", () => {
    // future date AND bad key → key wins, so an unknown key never reaches the RPC
    expect(
      validateResponsibilityMutation(
        { responsibilityKey: "LEAD", action: "assign", startedOn: "2099-01-01" },
        TODAY,
      ),
    ).toEqual({ ok: false, reason: "invalid_responsibility" });
  });

  it("rejects an invalid action", () => {
    expect(
      validateResponsibilityMutation(
        { responsibilityKey: "PARTNER", action: "drop", startedOn: null },
        TODAY,
      ),
    ).toEqual({ ok: false, reason: "invalid_action" });
  });

  it("rejects a future start date", () => {
    expect(
      validateResponsibilityMutation(
        { responsibilityKey: "TRAINER", action: "assign", startedOn: "2026-07-21" },
        TODAY,
      ),
    ).toEqual({ ok: false, reason: "start_date_in_future" });
  });

  it("ignores the date entirely for a removal (removal carries no date)", () => {
    expect(
      validateResponsibilityMutation(
        { responsibilityKey: "PEOPLE_MANAGER", action: "remove", startedOn: "2099-01-01" },
        TODAY,
      ),
    ).toEqual({ ok: true });
  });
});
