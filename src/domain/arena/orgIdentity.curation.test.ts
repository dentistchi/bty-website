import { describe, it, expect } from "vitest";
import {
  isCalendarDateString,
  roleStartDateError,
  validateIdentityCuration,
} from "./orgIdentity";

/**
 * Slice 3.1A-3 — pure curation validation. No Date.now(): "today" is injected, so these
 * tests are deterministic. Covers: unknown stays unknown, role-requires-family, incompatible
 * pair, future-date rejection, and real-calendar-date parsing.
 */

describe("isCalendarDateString", () => {
  it("accepts a real zero-padded date", () => {
    expect(isCalendarDateString("2026-07-19")).toBe(true);
    expect(isCalendarDateString("2000-02-29")).toBe(true); // leap year
  });
  it("rejects impossible or malformed dates", () => {
    expect(isCalendarDateString("2026-02-30")).toBe(false);
    expect(isCalendarDateString("2026-13-01")).toBe(false);
    expect(isCalendarDateString("2026-7-9")).toBe(false); // not zero-padded
    expect(isCalendarDateString("07/19/2026")).toBe(false);
    expect(isCalendarDateString("")).toBe(false);
    expect(isCalendarDateString(null)).toBe(false);
    expect(isCalendarDateString(20260719)).toBe(false);
  });
});

describe("roleStartDateError", () => {
  const today = "2026-07-19";
  it("treats unknown (null/undefined) as valid — never inferred", () => {
    expect(roleStartDateError(null, today)).toBeNull();
    expect(roleStartDateError(undefined, today)).toBeNull();
  });
  it("accepts today and the past", () => {
    expect(roleStartDateError("2026-07-19", today)).toBeNull();
    expect(roleStartDateError("2001-01-01", today)).toBeNull();
  });
  it("rejects a future date", () => {
    expect(roleStartDateError("2026-07-20", today)).toBe("in_future");
    expect(roleStartDateError("2099-01-01", today)).toBe("in_future");
  });
  it("rejects a non-date", () => {
    expect(roleStartDateError("nope", today)).toBe("not_a_date");
  });

  it("treats the date as a pure calendar string — 2026-07-01 stays 2026-07-01 (no timezone shift)", () => {
    // Validation must never convert to a timestamp/UTC-midnight — the exact string is what
    // flows on to storage. Accept it under a range of injected "today" values without mutation.
    for (const todayISO of ["2026-07-01", "2026-12-31", "2030-01-01"]) {
      expect(roleStartDateError("2026-07-01", todayISO)).toBeNull();
    }
    expect(isCalendarDateString("2026-07-01")).toBe(true);
  });
});

describe("validateIdentityCuration", () => {
  const today = "2026-07-19";

  it("allows fully-unknown identity (needs-curation state)", () => {
    expect(validateIdentityCuration({}, today)).toEqual({ ok: true });
    expect(
      validateIdentityCuration({ jobFamilyKey: null, primaryRoleKey: null, roleStartedOn: null }, today),
    ).toEqual({ ok: true });
  });

  it("allows a family alone (role still unknown)", () => {
    expect(validateIdentityCuration({ jobFamilyKey: "CLINICAL_PROVIDER" }, today)).toEqual({ ok: true });
  });

  it("accepts a compatible family+role+past-date", () => {
    expect(
      validateIdentityCuration(
        { jobFamilyKey: "CLINICAL_PROVIDER", primaryRoleKey: "GENERAL_DENTIST", roleStartedOn: "2020-05-01" },
        today,
      ),
    ).toEqual({ ok: true });
  });

  it("rejects a role without a family — never derives family from role", () => {
    expect(validateIdentityCuration({ primaryRoleKey: "GENERAL_DENTIST" }, today)).toEqual({
      ok: false,
      reason: "role_requires_family",
    });
  });

  it("rejects an incompatible family+role pair", () => {
    expect(
      validateIdentityCuration({ jobFamilyKey: "SHARED_SERVICES", primaryRoleKey: "GENERAL_DENTIST" }, today),
    ).toEqual({ ok: false, reason: "incompatible" });
  });

  it("rejects unknown keys (label/position never accepted as identity)", () => {
    expect(validateIdentityCuration({ jobFamilyKey: "Clinical Provider" }, today)).toEqual({
      ok: false,
      reason: "invalid_family",
    });
    expect(
      validateIdentityCuration({ jobFamilyKey: "CLINICAL_PROVIDER", primaryRoleKey: "Dentist" }, today),
    ).toEqual({ ok: false, reason: "invalid_role" });
  });

  it("rejects a future role date", () => {
    expect(
      validateIdentityCuration(
        { jobFamilyKey: "CLINICAL_PROVIDER", primaryRoleKey: "GENERAL_DENTIST", roleStartedOn: "2030-01-01" },
        today,
      ),
    ).toEqual({ ok: false, reason: "role_date_in_future" });
  });
});
