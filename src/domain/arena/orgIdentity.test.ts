import { describe, it, expect } from "vitest";
import {
  JOB_FAMILY_KEYS,
  PRIMARY_ROLE_KEYS,
  ROLE_TO_FAMILY,
  IDENTITY_SOURCES,
  isJobFamilyKey,
  isPrimaryRoleKey,
  isIdentitySource,
  familyForRole,
  isFamilyRoleCompatible,
} from "./orgIdentity";
import { JOB_FAMILY_LABELS, PRIMARY_ROLE_LABELS } from "@/lib/bty/arena/orgIdentityLabels";

/**
 * Canonical identity taxonomy (Slice 3.1A-1) — stable keys, family↔role compatibility,
 * and the label/key separation. Authorization keys are the source of truth; labels are
 * never keys.
 */

describe("orgIdentity taxonomy keys", () => {
  it("exposes the 7 job families and 11 primary roles", () => {
    expect(JOB_FAMILY_KEYS).toHaveLength(7);
    expect(PRIMARY_ROLE_KEYS).toHaveLength(11);
  });

  it("every primary role maps to exactly one allowed job family", () => {
    for (const role of PRIMARY_ROLE_KEYS) {
      const fam = ROLE_TO_FAMILY[role];
      expect(JOB_FAMILY_KEYS).toContain(fam);
      expect(familyForRole(role)).toBe(fam);
    }
  });

  it("locks the founder-specified role→family pairs", () => {
    expect(ROLE_TO_FAMILY.GENERAL_DENTIST).toBe("CLINICAL_PROVIDER");
    expect(ROLE_TO_FAMILY.ORTHODONTIST).toBe("CLINICAL_PROVIDER");
    expect(ROLE_TO_FAMILY.DENTAL_ASSISTANT).toBe("CLINICAL_SUPPORT");
    expect(ROLE_TO_FAMILY.OFFICE_ADMIN).toBe("FRONT_OFFICE_ADMIN");
    expect(ROLE_TO_FAMILY.OFFICE_MANAGER).toBe("OFFICE_MANAGEMENT");
    expect(ROLE_TO_FAMILY.AREA_MANAGER).toBe("REGIONAL_OPERATIONS");
    expect(ROLE_TO_FAMILY.STATE_REGIONAL_DIRECTOR).toBe("REGIONAL_OPERATIONS");
  });

  it("keeps AREA_MANAGER and STATE_REGIONAL_DIRECTOR as distinct roles (same family)", () => {
    expect(isPrimaryRoleKey("AREA_MANAGER")).toBe(true);
    expect(isPrimaryRoleKey("STATE_REGIONAL_DIRECTOR")).toBe(true);
    expect("AREA_MANAGER").not.toBe("STATE_REGIONAL_DIRECTOR");
  });

  it("does NOT treat Partner/Clinical Director/Trainer/Lead as primary roles", () => {
    for (const notRole of ["PARTNER", "CLINICAL_DIRECTOR", "TRAINER", "LEAD"]) {
      expect(isPrimaryRoleKey(notRole)).toBe(false);
    }
  });

  it("identity sources are the three bounded provenance keys", () => {
    expect(IDENTITY_SOURCES).toEqual(["legacy_approved_request", "membership_approval", "admin_curated"]);
    expect(isIdentitySource("membership_approval")).toBe(true);
    expect(isIdentitySource("guessed")).toBe(false);
  });
});

describe("validators", () => {
  it("rejects unknown keys and the free-text legacy values", () => {
    expect(isJobFamilyKey("CLINICAL_PROVIDER")).toBe(true);
    expect(isJobFamilyKey("leader")).toBe(false); // legacy job_function is NOT a family
    expect(isJobFamilyKey("staff")).toBe(false);
    expect(isPrimaryRoleKey("leader")).toBe(false);
    expect(isPrimaryRoleKey("")).toBe(false);
  });

  it("family/role compatibility: unknown on either side is allowed (never guesses)", () => {
    expect(isFamilyRoleCompatible(null, null)).toBe(true);
    expect(isFamilyRoleCompatible("CLINICAL_PROVIDER", null)).toBe(true);
    expect(isFamilyRoleCompatible(null, "GENERAL_DENTIST")).toBe(true);
  });

  it("family/role compatibility: matching pair ok, mismatched pair rejected", () => {
    expect(isFamilyRoleCompatible("CLINICAL_PROVIDER", "GENERAL_DENTIST")).toBe(true);
    expect(isFamilyRoleCompatible("REGIONAL_OPERATIONS", "AREA_MANAGER")).toBe(true);
    expect(isFamilyRoleCompatible("CLINICAL_SUPPORT", "GENERAL_DENTIST")).toBe(false);
    expect(isFamilyRoleCompatible("OFFICE_MANAGEMENT", "DENTAL_ASSISTANT")).toBe(false);
  });
});

describe("label/key separation", () => {
  it("labels exist for every key and are human copy, never equal to the key", () => {
    for (const fam of JOB_FAMILY_KEYS) {
      expect(JOB_FAMILY_LABELS[fam]).toBeTruthy();
      expect(JOB_FAMILY_LABELS[fam]).not.toBe(fam); // a label is not an authorization key
    }
    for (const role of PRIMARY_ROLE_KEYS) {
      expect(PRIMARY_ROLE_LABELS[role]).toBeTruthy();
      expect(PRIMARY_ROLE_LABELS[role]).not.toBe(role);
    }
  });

  it("a display label is never a valid taxonomy key", () => {
    for (const label of Object.values(PRIMARY_ROLE_LABELS)) {
      expect(isPrimaryRoleKey(label)).toBe(false);
    }
    for (const label of Object.values(JOB_FAMILY_LABELS)) {
      expect(isJobFamilyKey(label)).toBe(false);
    }
  });
});
