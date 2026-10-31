import { describe, expect, it } from "vitest";
import { legacyCoreOracle, validateConnectedServer, validateLocalTarget } from "../../../../scripts/legacy-xp-postgres-qa";

// These always-run tests verify harness safety/oracle only. Actual SQL evidence
// comes from the explicit driver command; no skipped database suite implies PASS.
describe("legacy XP SQL harness target guards and frozen TypeScript oracle", () => {
  it("accepts only the task database on the designated literal loopback port", () => {
    expect(validateLocalTarget("postgresql://postgres@127.0.0.1:55473/bty_legacy_xp_atomic_qa").hostname).toBe("127.0.0.1");
    for (const value of [undefined, "postgresql://db.example.com:55473/bty_legacy_xp_atomic_qa",
      "postgresql://127.0.0.1:5432/bty_legacy_xp_atomic_qa", "postgresql://127.0.0.1:55473/postgres",
      "postgresql://localhost:55473/bty_legacy_xp_atomic_qa", "postgresql://127.0.0.1:55473/bty_legacy_xp_atomic_qa?host=db.example.com"])
      expect(() => validateLocalTarget(value)).toThrow();
  });
  it("preserves the preexisting 200-Core conversion boundary and fractional buffer", () => {
    expect(legacyCoreOracle(199, 2 / 3)).toMatchObject({ core: 200, buffer: 0.33333333333333326, gain: 1 });
    expect(legacyCoreOracle(200, 0)).toMatchObject({ core: 200, buffer: 0.5, gain: 0 });
    expect(legacyCoreOracle(249, 0.999, true, "Custom")).toMatchObject({ core: 250, subName: "Custom" });
  });
  it("accepts a private container server address only with both explicit CI flags", () => {
    const server = { db: "bty_legacy_xp_atomic_qa", host: "172.18.0.2", port: 55473 };
    expect(() => validateConnectedServer(server)).toThrow();
    expect(() => validateConnectedServer(server, { containerService: true })).toThrow();
    expect(() => validateConnectedServer(server, { githubActions: true })).toThrow();
    const ci = { containerService: true, githubActions: true };
    for (const host of ["10.0.0.2", "172.16.0.2", "172.31.255.2", "192.168.1.2"])
      expect(() => validateConnectedServer({ ...server, host }, ci)).not.toThrow();
    for (const host of ["8.8.8.8", "172.15.0.2", "172.32.0.2", "192.169.1.2", "10.0.0.256", "localhost", "::ffff:172.18.0.2"])
      expect(() => validateConnectedServer({ ...server, host }, ci)).toThrow();
    expect(() => validateConnectedServer({ ...server, db: "postgres" }, ci)).toThrow();
    expect(() => validateConnectedServer({ ...server, port: 5432 }, ci)).toThrow();
    expect(() => validateConnectedServer({ ...server, host: "127.0.0.1" })).not.toThrow();
  });
});
