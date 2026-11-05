import { afterEach, describe, expect, it, vi } from "vitest";
import { isAiPatientAllowed } from "./aiPatientAccess";

afterEach(() => vi.unstubAllEnvs());

describe("AI Patient access policy", () => {
  it.each(["", "allowlist"])("keeps the existing allowlist when mode is %j", (mode) => {
    vi.stubEnv("AI_PATIENT_ACCESS_MODE", mode);
    vi.stubEnv("AI_PATIENT_ALLOWED_USER_IDS", " User-A, user-b ");
    expect(isAiPatientAllowed("user-a")).toBe(true);
    expect(isAiPatientAllowed("USER-B")).toBe(true);
    expect(isAiPatientAllowed("another-user")).toBe(false);
    vi.stubEnv("AI_PATIENT_ALLOWED_USER_IDS", "");
    expect(isAiPatientAllowed("user-a")).toBe(false);
  });

  it("explicit all_consented policy admits a user absent from the allowlist", () => {
    vi.stubEnv("AI_PATIENT_ACCESS_MODE", "all_consented");
    vi.stubEnv("AI_PATIENT_ALLOWED_USER_IDS", "");
    expect(isAiPatientAllowed("staff-user")).toBe(true);
    expect(isAiPatientAllowed("")).toBe(false);
    expect(isAiPatientAllowed("   ")).toBe(false);
  });

  it.each(["all", "ALL_CONSENTED", "all-consented", "closed"])("unknown mode %j refuses even an allowlisted user", (mode) => {
    vi.stubEnv("AI_PATIENT_ACCESS_MODE", mode);
    vi.stubEnv("AI_PATIENT_ALLOWED_USER_IDS", "user-a");
    expect(isAiPatientAllowed("user-a")).toBe(false);
  });
});
