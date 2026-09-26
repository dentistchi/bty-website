/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import {
  resolveGreetingAddress,
  earnsProfessionalAddress,
  PROFESSIONAL_JOB_FAMILY_KEY,
  PROFESSIONAL_ROLE_KEYS,
  GENERIC_GREETING_ADDRESS,
} from "./greetingAddress";

/** The canonical pair as `bty_org_memberships` stores it. */
const provider = (primaryRoleKey: string) => ({ jobFamilyKey: "CLINICAL_PROVIDER", primaryRoleKey });

describe("resolveGreetingAddress — doctor form", () => {
  it("A. CLINICAL_PROVIDER + GENERAL_DENTIST → doctor form", () => {
    expect(resolveGreetingAddress({ fullName: "Hanbit Chi", professionalIdentity: provider("GENERAL_DENTIST") })).toEqual({
      kind: "doctor",
      addressee: "Chi",
    });
  });

  it("B. CLINICAL_PROVIDER + ORTHODONTIST → doctor form (the gap the free-text rule had)", () => {
    expect(resolveGreetingAddress({ fullName: "Mia Park", professionalIdentity: provider("ORTHODONTIST") })).toEqual({
      kind: "doctor",
      addressee: "Park",
    });
  });

  it("C. CLINICAL_SUPPORT + DENTAL_ASSISTANT → personal form", () => {
    expect(
      resolveGreetingAddress({
        fullName: "Hanna Kim",
        professionalIdentity: { jobFamilyKey: "CLINICAL_SUPPORT", primaryRoleKey: "DENTAL_ASSISTANT" },
      }),
    ).toEqual({ kind: "personal", addressee: "Hanna" });
  });

  it("E. no canonical membership at all → personal form", () => {
    expect(resolveGreetingAddress({ fullName: "Hanbit Chi", professionalIdentity: null })).toEqual({
      kind: "personal",
      addressee: "Hanbit",
    });
    expect(resolveGreetingAddress({ fullName: "Hanbit Chi" })).toEqual({ kind: "personal", addressee: "Hanbit" });
  });

  it("F. membership present but both role fields null → personal form", () => {
    expect(
      resolveGreetingAddress({
        fullName: "Hanbit Chi",
        professionalIdentity: { jobFamilyKey: null, primaryRoleKey: null },
      }),
    ).toEqual({ kind: "personal", addressee: "Hanbit" });
  });

  it("doctor + first/last name → the family name, for 'Good morning, Dr. Chi.'", () => {
    expect(
      resolveGreetingAddress({ fullName: "Hanbit Chi", professionalIdentity: provider("GENERAL_DENTIST") }),
    ).toEqual({ kind: "doctor", addressee: "Chi" });
  });

  it("takes the family name from a three-part name", () => {
    expect(
      resolveGreetingAddress({ fullName: "Ana Maria Santos", professionalIdentity: provider("GENERAL_DENTIST") }),
    ).toEqual({ kind: "doctor", addressee: "Santos" });
  });

  it("a name that ALREADY carries the honorific does not become 'Dr. Dr. Chi'", () => {
    for (const n of ["Dr. Hanbit Chi", "Dr Hanbit Chi", "doctor Hanbit Chi"]) {
      expect(resolveGreetingAddress({ fullName: n, professionalIdentity: provider("GENERAL_DENTIST") })).toEqual({
        kind: "doctor",
        addressee: "Chi",
      });
    }
  });

  it("REAL PROVIDER NAME: 'Dr. Hanbit Chi (hc)' → 'Dr. Chi', never 'Dr. (hc)'", () => {
    // Measured on a live account: the provider name carries BOTH an honorific and a bracketed
    // handle. The last whitespace token is "(hc)".
    const out = resolveGreetingAddress({
      fullName: "Dr. Hanbit Chi (hc)",
      professionalIdentity: provider("GENERAL_DENTIST"),
    });
    expect(out).toEqual({ kind: "doctor", addressee: "Chi" });
  });

  it("drops credential suffixes and comma separators before taking the family name", () => {
    expect(resolveGreetingAddress({ fullName: "Hanbit Chi, DDS", professionalIdentity: provider("GENERAL_DENTIST") })).toEqual({
      kind: "doctor",
      addressee: "Chi",
    });
    expect(resolveGreetingAddress({ fullName: "Hanbit Chi Jr.", professionalIdentity: provider("GENERAL_DENTIST") })).toEqual({
      kind: "doctor",
      addressee: "Chi",
    });
  });

  it("keeps a hyphenated or apostrophised family name intact", () => {
    expect(resolveGreetingAddress({ fullName: "Sean O\u2019Brien", professionalIdentity: provider("GENERAL_DENTIST") })).toEqual({
      kind: "doctor",
      addressee: "O\u2019Brien",
    });
    expect(resolveGreetingAddress({ fullName: "Mia Park-Lee", professionalIdentity: provider("GENERAL_DENTIST") })).toEqual({
      kind: "doctor",
      addressee: "Park-Lee",
    });
  });

  it("BOTH licensed provider roles reach the doctor form", () => {
    for (const role of PROFESSIONAL_ROLE_KEYS) {
      expect(resolveGreetingAddress({ fullName: "Hanbit Chi", professionalIdentity: provider(role) })).toEqual({
        kind: "doctor",
        addressee: "Chi",
      });
    }
  });

  it("one doctor role among several non-doctor roles still earns it", () => {
    expect(
      resolveGreetingAddress({
        fullName: "Hanbit Chi",
        professionalIdentity: provider("ORTHODONTIST"),
      }),
    ).toEqual({ kind: "doctor", addressee: "Chi" });
  });
});

describe("resolveGreetingAddress — personal form", () => {
  it("non-doctor + preferred name → the preferred name", () => {
    expect(
      resolveGreetingAddress({
        preferredName: "Hanna",
        fullName: "Hanna-Young Kim",
        professionalIdentity: { jobFamilyKey: "CLINICAL_SUPPORT", primaryRoleKey: "DENTAL_ASSISTANT" },
      }),
    ).toEqual({ kind: "personal", addressee: "Hanna" });
  });

  it("non-doctor + no preferred name → the first name", () => {
    expect(resolveGreetingAddress({ fullName: "Sarah Lee", professionalIdentity: { jobFamilyKey: "CLINICAL_SUPPORT", primaryRoleKey: "DENTAL_ASSISTANT" } })).toEqual({
      kind: "personal",
      addressee: "Sarah",
    });
  });

  it("a bracketed handle never becomes the first name either", () => {
    expect(resolveGreetingAddress({ fullName: "(hc) Hanbit Chi", professionalIdentity: { jobFamilyKey: "OFFICE_MANAGEMENT", primaryRoleKey: "OFFICE_MANAGER" } })).toEqual({
      kind: "personal",
      addressee: "Hanbit",
    });
    // Nothing but a handle is not a name at all.
    expect(resolveGreetingAddress({ fullName: "(hc)", professionalIdentity: provider("GENERAL_DENTIST") })).toEqual(
      GENERIC_GREETING_ADDRESS,
    );
  });

  it("a missing position is a safe NON-doctor fallback, never a guess", () => {
    expect(resolveGreetingAddress({ fullName: "Hanbit Chi" })).toEqual({
      kind: "personal",
      addressee: "Hanbit",
    });
    expect(resolveGreetingAddress({ fullName: "Hanbit Chi", professionalIdentity: null })).toEqual({
      kind: "personal",
      addressee: "Hanbit",
    });
  });

  it("a doctor with no separable family name falls back to the display name, never 'Dr. undefined'", () => {
    expect(resolveGreetingAddress({ fullName: "지한빛", professionalIdentity: provider("GENERAL_DENTIST") })).toEqual({
      kind: "personal",
      addressee: "지한빛",
    });
    // The honorific alone leaves nothing to split on either.
    expect(resolveGreetingAddress({ fullName: "Chi", professionalIdentity: provider("GENERAL_DENTIST") })).toEqual({
      kind: "personal",
      addressee: "Chi",
    });
  });

  it("a NON-doctor whose name carries 'Dr.' is greeted by first name, without the honorific", () => {
    expect(resolveGreetingAddress({ fullName: "Dr. Hanna Kim", professionalIdentity: { jobFamilyKey: "OFFICE_MANAGEMENT", primaryRoleKey: "OFFICE_MANAGER" } })).toEqual(
      { kind: "personal", addressee: "Hanna" },
    );
  });
});

describe("resolveGreetingAddress — generic fallback", () => {
  it("no identity at all → the existing unnamed greeting", () => {
    expect(resolveGreetingAddress({})).toEqual(GENERIC_GREETING_ADDRESS);
    expect(resolveGreetingAddress({ fullName: "   ", name: null })).toEqual(GENERIC_GREETING_ADDRESS);
    expect(resolveGreetingAddress({ fullName: "null", professionalIdentity: provider("GENERAL_DENTIST") })).toEqual(
      GENERIC_GREETING_ADDRESS,
    );
  });

  it("NEVER derives a name from an email, at any tier", () => {
    expect(
      resolveGreetingAddress({
        profileFullName: "hanbit.chi@bty.com",
        fullName: "chi@bty.com",
        name: "h.chi@bty.com",
        professionalIdentity: provider("GENERAL_DENTIST"),
      }),
    ).toEqual(GENERIC_GREETING_ADDRESS);
  });

  it("a name with no letters is not a name", () => {
    expect(resolveGreetingAddress({ fullName: "1234", professionalIdentity: provider("GENERAL_DENTIST") })).toEqual(
      GENERIC_GREETING_ADDRESS,
    );
  });
});

describe("resolveGreetingAddress — precedence + boundaries", () => {
  it("the real name BTY holds beats the provider name", () => {
    expect(
      resolveGreetingAddress({ profileFullName: "Hanbit Chi", fullName: "hchi", name: "hchi" }),
    ).toEqual({ kind: "personal", addressee: "Hanbit" });
  });

  it("falls to provider `name` only when the fuller sources are unusable", () => {
    expect(resolveGreetingAddress({ profileFullName: null, fullName: "", name: "Sarah Lee" })).toEqual(
      { kind: "personal", addressee: "Sarah" },
    );
  });

  it("the role string itself NEVER becomes the addressee", () => {
    const out = resolveGreetingAddress({
      fullName: "Hanbit Chi",
      professionalIdentity: provider("GENERAL_DENTIST"),
    });
    expect(out.addressee).toBe("Chi");
    expect(JSON.stringify(out)).not.toMatch(/director/i);
  });
});

describe("earnsProfessionalAddress — the canonical pair, and nothing else", () => {
  it("is true only for CLINICAL_PROVIDER + a licensed provider role", () => {
    expect(earnsProfessionalAddress(provider("GENERAL_DENTIST"))).toBe(true);
    expect(earnsProfessionalAddress(provider("ORTHODONTIST"))).toBe(true);
    expect(PROFESSIONAL_JOB_FAMILY_KEY).toBe("CLINICAL_PROVIDER");
  });

  it("RESPONSIBILITIES never establish it — leadership is not a credential", () => {
    for (const key of ["CLINICAL_DIRECTOR", "PARTNER", "TRAINER", "TEAM_LEAD", "PEOPLE_MANAGER"]) {
      // Even if a responsibility key were mistakenly passed as the role, it is not a provider role.
      expect(earnsProfessionalAddress(provider(key))).toBe(false);
      expect(earnsProfessionalAddress({ jobFamilyKey: key, primaryRoleKey: "GENERAL_DENTIST" })).toBe(false);
    }
  });

  it("no other canonical role earns it, and half a pair never does", () => {
    const cases: Array<{ jobFamilyKey: unknown; primaryRoleKey: unknown }> = [
      { jobFamilyKey: "CLINICAL_SUPPORT", primaryRoleKey: "DENTAL_ASSISTANT" },
      { jobFamilyKey: "OFFICE_MANAGEMENT", primaryRoleKey: "OFFICE_MANAGER" },
      { jobFamilyKey: "REGIONAL_OPERATIONS", primaryRoleKey: "STATE_REGIONAL_DIRECTOR" },
      { jobFamilyKey: "SHARED_SERVICES", primaryRoleKey: "SSO_IT" },
      { jobFamilyKey: "CLINICAL_PROVIDER", primaryRoleKey: null },
      { jobFamilyKey: null, primaryRoleKey: "GENERAL_DENTIST" },
      { jobFamilyKey: null, primaryRoleKey: null },
      { jobFamilyKey: "clinical_provider", primaryRoleKey: "general_dentist" }, // keys are stored, not typed
      { jobFamilyKey: "CLINICAL_PROVIDER", primaryRoleKey: "DENTIST" },
      { jobFamilyKey: 7, primaryRoleKey: 7 },
    ];
    for (const c of cases) expect(earnsProfessionalAddress(c)).toBe(false);
    expect(earnsProfessionalAddress(null)).toBe(false);
    expect(earnsProfessionalAddress(undefined)).toBe(false);
  });

  it("the FREE-TEXT vocabulary is gone — a legacy job_function string no longer earns it", () => {
    for (const legacy of ["doctor", "dentist", "senior_doctor", "Lead Dentist", "clinical director"]) {
      expect(earnsProfessionalAddress({ jobFamilyKey: legacy, primaryRoleKey: legacy })).toBe(false);
      expect(
        resolveGreetingAddress({ fullName: "Hanbit Chi", professionalIdentity: { jobFamilyKey: legacy, primaryRoleKey: legacy } }),
      ).toEqual({ kind: "personal", addressee: "Hanbit" });
    }
  });
});
