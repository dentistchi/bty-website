import { describe, expect, it } from "vitest";
import { validateHealingLocalTarget, validateHealingServer } from "../../../../scripts/healing-atomic-postgres-qa";

// Always-active guard tests, not a skipped/implicit SQL PASS. Real SQL uses the
// explicit disposable engine command and reports its own evidence/unrun list.
describe("Healing atomic SQL harness target guards", () => {
  it("accepts only the designated disposable database on literal loopback55473", () => {
    expect(validateHealingLocalTarget("postgresql://postgres@127.0.0.1:55473/bty_healing_atomic_qa").hostname).toBe("127.0.0.1");
    for (const value of [undefined, "postgresql://db.example.com:55473/bty_healing_atomic_qa", "postgresql://localhost:55473/bty_healing_atomic_qa", "postgresql://127.0.0.1:5432/bty_healing_atomic_qa", "postgresql://127.0.0.1:55473/postgres", "postgresql://127.0.0.1:55473/bty_healing_atomic_qa?host=db.example.com", "postgresql://127.0.0.1:55473/bty_healing_atomic_qa#other"])
      expect(() => validateHealingLocalTarget(value)).toThrow();
  });
  it("requires both CI flags for a private container server and never accepts public/masked addresses", () => {
    const s = { db: "bty_healing_atomic_qa", host: "172.18.0.2", port: 55473 };
    for (const options of [{}, { containerService: true }, { githubActions: true }]) expect(() => validateHealingServer(s, options)).toThrow();
    const flags = { containerService: true, githubActions: true };
    expect(() => validateHealingServer(s, flags)).not.toThrow();
    for (const host of ["8.8.8.8", "172.15.0.2", "172.32.0.2", "10.0.0.256", "172.18.0.2/32", "::1/128"])
      expect(() => validateHealingServer({ ...s, host }, flags)).toThrow();
    expect(() => validateHealingServer({ ...s, host: "127.0.0.1" })).not.toThrow();
    expect(() => validateHealingServer({ ...s, db: "postgres" }, flags)).toThrow();
    expect(() => validateHealingServer({ ...s, port: 5432 }, flags)).toThrow();
  });
});
