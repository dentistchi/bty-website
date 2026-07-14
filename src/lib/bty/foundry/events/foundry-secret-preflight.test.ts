import { describe, it, expect, afterEach } from "vitest";
import {
  assertFoundryRoomSecretConfigured,
  signFoundryRoomToken,
} from "./foundry-room-token";

/**
 * §7 — production preflight: deployed envs MUST use the dedicated
 * FOUNDRY_ROOM_QR_SECRET; the Arena/CRON fallback is local/test only.
 */
const saved = {
  env: process.env.BTY_ENV,
  foundry: process.env.FOUNDRY_ROOM_QR_SECRET,
  event: process.env.EVENT_QR_SECRET,
  cron: process.env.CRON_SECRET,
};

afterEach(() => {
  process.env.BTY_ENV = saved.env;
  if (saved.foundry === undefined) delete process.env.FOUNDRY_ROOM_QR_SECRET;
  else process.env.FOUNDRY_ROOM_QR_SECRET = saved.foundry;
  if (saved.event === undefined) delete process.env.EVENT_QR_SECRET;
  else process.env.EVENT_QR_SECRET = saved.event;
  if (saved.cron === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = saved.cron;
});

const mint = () =>
  signFoundryRoomToken({ type: "foundry_room", eventId: "e", joinVersion: 1, iat: 1 });

describe("assertFoundryRoomSecretConfigured", () => {
  it("throws in production when the dedicated secret is absent", () => {
    process.env.BTY_ENV = "production";
    delete process.env.FOUNDRY_ROOM_QR_SECRET;
    expect(() => assertFoundryRoomSecretConfigured()).toThrow(/FOUNDRY_ROOM_QR_SECRET/);
  });

  it("throws in staging (production-effective) when absent", () => {
    process.env.BTY_ENV = "staging";
    delete process.env.FOUNDRY_ROOM_QR_SECRET;
    expect(() => assertFoundryRoomSecretConfigured()).toThrow();
  });

  it("passes when the dedicated secret is present in production", () => {
    process.env.BTY_ENV = "production";
    process.env.FOUNDRY_ROOM_QR_SECRET = "dedicated-prod-secret-xxxxxxxxxxxx";
    expect(() => assertFoundryRoomSecretConfigured()).not.toThrow();
  });

  it("is a no-op in local/test (no BTY_ENV)", () => {
    delete process.env.BTY_ENV;
    delete process.env.FOUNDRY_ROOM_QR_SECRET;
    expect(() => assertFoundryRoomSecretConfigured()).not.toThrow();
  });
});

describe("signFoundryRoomToken secret resolution", () => {
  it("refuses the Arena/CRON fallback in production", () => {
    process.env.BTY_ENV = "production";
    delete process.env.FOUNDRY_ROOM_QR_SECRET;
    process.env.CRON_SECRET = "some-cron-secret";
    expect(() => mint()).toThrow(/FOUNDRY_ROOM_QR_SECRET/);
  });

  it("accepts the fallback in local/test only", () => {
    delete process.env.BTY_ENV;
    delete process.env.FOUNDRY_ROOM_QR_SECRET;
    process.env.EVENT_QR_SECRET = "event-secret-fallback-for-local";
    expect(() => mint()).not.toThrow();
  });

  it("uses the dedicated secret in production", () => {
    process.env.BTY_ENV = "production";
    process.env.FOUNDRY_ROOM_QR_SECRET = "dedicated-prod-secret-xxxxxxxxxxxx";
    expect(mint().startsWith("btyfr1.")).toBe(true);
  });
});
