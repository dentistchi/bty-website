import { describe, it, expect } from "vitest";
import {
  LabXPViolation,
  XP_GRANT_ORIGIN,
  guardWeeklyXpAgainstLabOrigin,
} from "./lab-xp.service";

describe("lab-xp.service guards", () => {
  it("throws LabXPViolation when weekly bucket with lab_session origin", () => {
    expect(() =>
      guardWeeklyXpAgainstLabOrigin(XP_GRANT_ORIGIN.LAB_SESSION, "weekly"),
    ).toThrow(LabXPViolation);
  });

  it("allows core bucket with lab_session origin", () => {
    expect(() =>
      guardWeeklyXpAgainstLabOrigin(XP_GRANT_ORIGIN.LAB_SESSION, "core"),
    ).not.toThrow();
  });

  it("allows weekly with arena_run origin", () => {
    expect(() =>
      guardWeeklyXpAgainstLabOrigin(XP_GRANT_ORIGIN.ARENA_RUN, "weekly"),
    ).not.toThrow();
  });
});
