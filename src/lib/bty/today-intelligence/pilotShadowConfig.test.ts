/**
 * Pilot shadow — CONFIG gate (matrix §12: CONFIG 1–6). Synthetic env only; no secrets, no DB.
 */
import { describe, it, expect } from "vitest";
import { loadPilotShadowConfig } from "@/lib/bty/today-intelligence/pilotShadowConfig";
import { runPilotEvidenceShadow, type PilotSignalReaders } from "@/lib/bty/today-intelligence/pilotShadow";
import { SYNTH_USER_ID, SYNTH_TZ } from "@/lib/bty/today-intelligence/__fixtures__/pilotShadowFixtures";

const NOW = new Date("2026-07-10T18:00:00Z");

/** Readers that EXPLODE if ever invoked — proves the config gate blocks before any reader runs. */
const explodingReaders: PilotSignalReaders = {
  readCompletionsForLatency: () => Promise.reject(new Error("READER_MUST_NOT_RUN")),
  readTopSignature: () => Promise.reject(new Error("READER_MUST_NOT_RUN")),
  buildBrief: () => Promise.reject(new Error("READER_MUST_NOT_RUN")),
};

async function runWith(env: Record<string, string | undefined>) {
  const config = loadPilotShadowConfig(env);
  const status = await runPilotEvidenceShadow({ config, now: NOW, armed: true, readers: explodingReaders });
  return { config, status };
}

describe("pilot config gate", () => {
  it("1. pilot ID missing → blocked before reader invocation", async () => {
    const { config, status } = await runWith({ TODAY_MIRROR_PILOT_TIMEZONE: SYNTH_TZ });
    expect(config).toEqual({ ok: false, reason: "PILOT_ID_MISSING" });
    expect(status.verdict).toBe("BLOCKED_CONFIG");
    expect(status.packet.assembled).toBe(false);
  });

  it("2. pilot ID invalid → blocked before reader invocation", async () => {
    const { config, status } = await runWith({ TODAY_MIRROR_PILOT_USER_ID: "not-a-uuid", TODAY_MIRROR_PILOT_TIMEZONE: SYNTH_TZ });
    expect(config).toEqual({ ok: false, reason: "PILOT_ID_INVALID" });
    expect(status.verdict).toBe("BLOCKED_CONFIG");
  });

  it("3. timezone missing → blocked before reader invocation", async () => {
    const { config, status } = await runWith({ TODAY_MIRROR_PILOT_USER_ID: SYNTH_USER_ID });
    expect(config).toEqual({ ok: false, reason: "PILOT_TIMEZONE_MISSING" });
    expect(status.verdict).toBe("BLOCKED_CONFIG");
    expect(status.config).toEqual({ identityConfigured: true, timezoneConfigured: false, timezoneValid: false });
  });

  it("4. timezone invalid → blocked before reader invocation (no silent UTC)", async () => {
    const { config, status } = await runWith({ TODAY_MIRROR_PILOT_USER_ID: SYNTH_USER_ID, TODAY_MIRROR_PILOT_TIMEZONE: "Mars/Phobos" });
    expect(config).toEqual({ ok: false, reason: "PILOT_TIMEZONE_INVALID" });
    expect(status.verdict).toBe("BLOCKED_CONFIG");
    expect(status.config.timezoneValid).toBe(false);
  });

  it("5. valid synthetic config → proceeds (config.ok, all booleans true)", async () => {
    const config = loadPilotShadowConfig({ TODAY_MIRROR_PILOT_USER_ID: SYNTH_USER_ID, TODAY_MIRROR_PILOT_TIMEZONE: SYNTH_TZ });
    expect(config).toEqual({ ok: true, config: { userId: SYNTH_USER_ID, timezone: SYNTH_TZ } });
  });

  it("6. E2E / SMOKE / cleanup fixture identity is rejected, never a fallback", async () => {
    for (const id of ["E2E_user_123", "smoke-11111111-2222-4333-8444-555555555555", "cleanup-fixture", "11111111-2222-4333-8444-555555555555-seed"]) {
      const r = loadPilotShadowConfig({ TODAY_MIRROR_PILOT_USER_ID: id, TODAY_MIRROR_PILOT_TIMEZONE: SYNTH_TZ });
      expect(r.ok).toBe(false);
    }
    // With the id absent, the loader does NOT substitute any fixture identity — it reports MISSING.
    const missing = loadPilotShadowConfig({ E2E_USER_ID: "x", SMOKE_USER_ID: "y", TODAY_MIRROR_PILOT_TIMEZONE: SYNTH_TZ });
    expect(missing).toEqual({ ok: false, reason: "PILOT_ID_MISSING" });
  });
});
