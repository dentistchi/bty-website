import { afterEach, describe, expect, it, vi } from "vitest";
import { AiPatientConfigError, resolveAiPatientSecret, sealSession, unsealSession } from "./sessionSeal";
import type { AiPatientSessionState } from "@/domain/arena/aiPatient/sessionRules";

const state: AiPatientSessionState = {
  v: 1,
  sid: "sid-1",
  uid: "user-a",
  caseId: "case-acceptance-01-v1",
  concern: "clinical_need_doubt",
  startedAt: 1,
  expiresAt: 2,
  turns: [{ role: "patient", text: "I think I need to think about it." }],
};

afterEach(() => vi.unstubAllEnvs());

describe("[AI patient] sealed session", () => {
  it("round-trips for its owner", async () => {
    vi.stubEnv("AI_PATIENT_SESSION_SECRET", "test-secret");
    const sealed = await sealSession(state);
    expect(sealed.startsWith("aps1.")).toBe(true);
    expect(await unsealSession(sealed, "user-a")).toEqual({ ok: true, state });
  });

  it("does not expose the hidden concern or the transcript in readable form", async () => {
    vi.stubEnv("AI_PATIENT_SESSION_SECRET", "test-secret");
    const sealed = await sealSession(state);
    const decoded = Buffer.from(sealed.split(".")[2]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("latin1");
    expect(decoded).not.toContain("clinical_need_doubt");
    expect(decoded).not.toContain("think about it");
  });

  it("refuses a session altered by even one character", async () => {
    vi.stubEnv("AI_PATIENT_SESSION_SECRET", "test-secret");
    const sealed = await sealSession(state);
    const [p, iv, ct] = sealed.split(".");
    const flipped = `${p}.${iv}.${ct!.slice(0, 10)}${ct![10] === "A" ? "B" : "A"}${ct!.slice(11)}`;
    expect(await unsealSession(flipped, "user-a")).toEqual({ ok: false, reason: "tampered" });
  });

  it("refuses another user's session", async () => {
    vi.stubEnv("AI_PATIENT_SESSION_SECRET", "test-secret");
    expect(await unsealSession(await sealSession(state), "user-b")).toEqual({ ok: false, reason: "not_owner" });
  });

  it("refuses a session sealed under a different secret", async () => {
    vi.stubEnv("AI_PATIENT_SESSION_SECRET", "secret-one");
    const sealed = await sealSession(state);
    vi.stubEnv("AI_PATIENT_SESSION_SECRET", "secret-two");
    expect(await unsealSession(sealed, "user-a")).toEqual({ ok: false, reason: "tampered" });
  });

  it("refuses garbage without throwing", async () => {
    vi.stubEnv("AI_PATIENT_SESSION_SECRET", "test-secret");
    for (const v of [undefined, 42, "", "aps1.x", "zzz.a.b", "aps1.AAAA.BBBB"]) {
      const r = await unsealSession(v, "user-a");
      expect(r.ok).toBe(false);
    }
  });

  it("has no fallback secret in deployed environments", () => {
    vi.stubEnv("AI_PATIENT_SESSION_SECRET", "");
    vi.stubEnv("BTY_ENV", "staging");
    vi.stubEnv("CRON_SECRET", "cron");
    expect(() => resolveAiPatientSecret()).toThrow(AiPatientConfigError);
  });
});
