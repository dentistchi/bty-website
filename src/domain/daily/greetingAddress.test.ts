/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import {
  resolveGreetingAddress,
  isDoctorRole,
  DOCTOR_ROLE_VALUES,
  GENERIC_GREETING_ADDRESS,
} from "./greetingAddress";

describe("resolveGreetingAddress — doctor form", () => {
  it("doctor + first/last name → the family name, for 'Good morning, Dr. Chi.'", () => {
    expect(
      resolveGreetingAddress({ fullName: "Hanbit Chi", roleValues: ["Clinical Director"] }),
    ).toEqual({ kind: "doctor", addressee: "Chi" });
  });

  it("takes the family name from a three-part name", () => {
    expect(
      resolveGreetingAddress({ fullName: "Ana Maria Santos", roleValues: ["doctor"] }),
    ).toEqual({ kind: "doctor", addressee: "Santos" });
  });

  it("a name that ALREADY carries the honorific does not become 'Dr. Dr. Chi'", () => {
    for (const n of ["Dr. Hanbit Chi", "Dr Hanbit Chi", "doctor Hanbit Chi"]) {
      expect(resolveGreetingAddress({ fullName: n, roleValues: ["senior_doctor"] })).toEqual({
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
      roleValues: ["doctor"],
    });
    expect(out).toEqual({ kind: "doctor", addressee: "Chi" });
  });

  it("drops credential suffixes and comma separators before taking the family name", () => {
    expect(resolveGreetingAddress({ fullName: "Hanbit Chi, DDS", roleValues: ["doctor"] })).toEqual({
      kind: "doctor",
      addressee: "Chi",
    });
    expect(resolveGreetingAddress({ fullName: "Hanbit Chi Jr.", roleValues: ["doctor"] })).toEqual({
      kind: "doctor",
      addressee: "Chi",
    });
  });

  it("keeps a hyphenated or apostrophised family name intact", () => {
    expect(resolveGreetingAddress({ fullName: "Sean O\u2019Brien", roleValues: ["doctor"] })).toEqual({
      kind: "doctor",
      addressee: "O\u2019Brien",
    });
    expect(resolveGreetingAddress({ fullName: "Mia Park-Lee", roleValues: ["doctor"] })).toEqual({
      kind: "doctor",
      addressee: "Park-Lee",
    });
  });

  it("every canonical doctor role value reaches the doctor form", () => {
    for (const role of DOCTOR_ROLE_VALUES) {
      expect(resolveGreetingAddress({ fullName: "Hanbit Chi", roleValues: [role] }).kind).toBe(
        "doctor",
      );
    }
  });

  it("one doctor role among several non-doctor roles still earns it", () => {
    expect(
      resolveGreetingAddress({
        fullName: "Hanbit Chi",
        roleValues: ["staff", null, "Lead Dentist"],
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
        roleValues: ["hygienist"],
      }),
    ).toEqual({ kind: "personal", addressee: "Hanna" });
  });

  it("non-doctor + no preferred name → the first name", () => {
    expect(resolveGreetingAddress({ fullName: "Sarah Lee", roleValues: ["assistant"] })).toEqual({
      kind: "personal",
      addressee: "Sarah",
    });
  });

  it("a bracketed handle never becomes the first name either", () => {
    expect(resolveGreetingAddress({ fullName: "(hc) Hanbit Chi", roleValues: ["staff"] })).toEqual({
      kind: "personal",
      addressee: "Hanbit",
    });
    // Nothing but a handle is not a name at all.
    expect(resolveGreetingAddress({ fullName: "(hc)", roleValues: ["doctor"] })).toEqual(
      GENERIC_GREETING_ADDRESS,
    );
  });

  it("a missing position is a safe NON-doctor fallback, never a guess", () => {
    expect(resolveGreetingAddress({ fullName: "Hanbit Chi" })).toEqual({
      kind: "personal",
      addressee: "Hanbit",
    });
    expect(resolveGreetingAddress({ fullName: "Hanbit Chi", roleValues: [] })).toEqual({
      kind: "personal",
      addressee: "Hanbit",
    });
  });

  it("a doctor with no separable family name falls back to the display name, never 'Dr. undefined'", () => {
    expect(resolveGreetingAddress({ fullName: "지한빛", roleValues: ["doctor"] })).toEqual({
      kind: "personal",
      addressee: "지한빛",
    });
    // The honorific alone leaves nothing to split on either.
    expect(resolveGreetingAddress({ fullName: "Chi", roleValues: ["doctor"] })).toEqual({
      kind: "personal",
      addressee: "Chi",
    });
  });

  it("a NON-doctor whose name carries 'Dr.' is greeted by first name, without the honorific", () => {
    expect(resolveGreetingAddress({ fullName: "Dr. Hanna Kim", roleValues: ["office_manager"] })).toEqual(
      { kind: "personal", addressee: "Hanna" },
    );
  });
});

describe("resolveGreetingAddress — generic fallback", () => {
  it("no identity at all → the existing unnamed greeting", () => {
    expect(resolveGreetingAddress({})).toEqual(GENERIC_GREETING_ADDRESS);
    expect(resolveGreetingAddress({ fullName: "   ", name: null })).toEqual(GENERIC_GREETING_ADDRESS);
    expect(resolveGreetingAddress({ fullName: "null", roleValues: ["doctor"] })).toEqual(
      GENERIC_GREETING_ADDRESS,
    );
  });

  it("NEVER derives a name from an email, at any tier", () => {
    expect(
      resolveGreetingAddress({
        profileFullName: "hanbit.chi@bty.com",
        fullName: "chi@bty.com",
        name: "h.chi@bty.com",
        roleValues: ["doctor"],
      }),
    ).toEqual(GENERIC_GREETING_ADDRESS);
  });

  it("a name with no letters is not a name", () => {
    expect(resolveGreetingAddress({ fullName: "1234", roleValues: ["doctor"] })).toEqual(
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
      roleValues: ["Regional Clinical Director"],
    });
    expect(out.addressee).toBe("Chi");
    expect(JSON.stringify(out)).not.toMatch(/director/i);
  });
});

describe("isDoctorRole", () => {
  it("matches clinical roles by word, in any casing or separator", () => {
    for (const r of ["doctor", "Doctor", "senior_doctor", "Lead Dentist", "clinical-director", "Regional Clinical Director"]) {
      expect(isDoctorRole(r)).toBe(true);
    }
  });

  it("does NOT match roles that establish no clinical status", () => {
    for (const r of ["staff", "leader", "hygienist", "assistant", "admin", "office_manager", "regional_om", "director", "dso", "partner", "dental assistant", "", null, undefined, 7]) {
      expect(isDoctorRole(r)).toBe(false);
    }
  });
});
