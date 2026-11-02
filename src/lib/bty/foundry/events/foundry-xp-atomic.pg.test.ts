import { describe, expect, it } from "vitest";
import { FOUNDRY_AWARD_ORACLE, foundryCoreOracle, validateFoundryConnectedServer, validateFoundryLocalTarget } from "../../../../../scripts/foundry-xp-postgres-qa";

describe("Foundry SQL harness safety and frozen business oracle", () => {
  it("never substitutes a remote or application database", () => {
    expect(validateFoundryLocalTarget("postgresql://postgres@127.0.0.1:55473/bty_foundry_xp_atomic_qa").hostname).toBe("127.0.0.1");
    for (const bad of [undefined, "postgresql://db.example.org:55473/bty_foundry_xp_atomic_qa",
      "postgresql://localhost:55473/bty_foundry_xp_atomic_qa", "postgresql://127.0.0.1:5432/bty_foundry_xp_atomic_qa",
      "postgresql://127.0.0.1:55473/postgres", "postgresql://127.0.0.1:55473/bty_foundry_xp_atomic_qa?host=db.example.org"])
      expect(() => validateFoundryLocalTarget(bad)).toThrow();
  });
  it("requires both explicit CI flags for a plain RFC1918 server address", () => {
    const server = { db: "bty_foundry_xp_atomic_qa", host: "172.18.0.2", port: 55473 };
    expect(() => validateFoundryConnectedServer(server)).toThrow();
    expect(() => validateFoundryConnectedServer(server, { containerService: true })).toThrow();
    const flags = { containerService: true, githubActions: true };
    expect(() => validateFoundryConnectedServer(server, flags)).not.toThrow();
    for (const host of ["8.8.8.8", "172.32.0.2", "172.18.0.2/32", "::1/128", "10.0.0.256"])
      expect(() => validateFoundryConnectedServer({ ...server, host }, flags)).toThrow();
  });
  it("pins +10 permanent Core, three awards per day, no Weekly or buffer mutation", () => {
    expect(FOUNDRY_AWARD_ORACLE).toMatchObject({ coreGain: 10, maximumPerDay: 3, weeklyGain: 0, bufferGain: 0, ownerAward: false });
    expect(foundryCoreOracle(199)).toMatchObject({ core: 209, tier: 20, code: 0, stage: 3, hidden: false });
    expect(foundryCoreOracle(699, true, "Custom")).toMatchObject({ core: 709, stage: 7, hidden: true, subName: "Custom" });
  });
});
