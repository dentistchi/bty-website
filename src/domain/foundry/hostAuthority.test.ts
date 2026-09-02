import { describe, it, expect } from "vitest";
import {
  effectiveHostStatus,
  isMicrosoftManager,
  planManagerSync,
  type HostGrantState,
  type ManagerProbe,
} from "@/domain/foundry/hostAuthority";

/**
 * Host authority derivation (Microsoft Manager Authority V1).
 *
 * The revocation rule is the one that can do real damage, so it is proven here rather than
 * inferred from the network code that calls it.
 */

const manual = (userId: string): HostGrantState => ({
  userId,
  manualGranted: true,
  microsoftManagerGranted: false,
});
const synced = (userId: string): HostGrantState => ({
  userId,
  manualGranted: false,
  microsoftManagerGranted: true,
});
const both = (userId: string): HostGrantState => ({
  userId,
  manualGranted: true,
  microsoftManagerGranted: true,
});

describe("manager entitlement comes from direct reports and NOTHING else", () => {
  it("is exactly '>= 1 current direct report'", () => {
    expect(isMicrosoftManager(1)).toBe(true);
    expect(isMicrosoftManager(200)).toBe(true);
    expect(isMicrosoftManager(0)).toBe(false);
    expect(isMicrosoftManager(-1)).toBe(false);
    expect(isMicrosoftManager(Number.NaN)).toBe(false);
  });

  it("★ takes no attribute that could stand in for a title", () => {
    /*
      A regression here would not throw — it would quietly make "Manager, Facilities" or an
      @leadership address into authority. Pinning the arity is the cheapest way to make adding
      such a parameter a deliberate, visible act.
    */
    expect(isMicrosoftManager.length).toBe(1);
    const src = isMicrosoftManager.toString();
    for (const forbidden of ["jobTitle", "department", "mail", "userPrincipalName", "displayName", "owner"]) {
      expect(src, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe("effective status is the OR of the two sources", () => {
  it("either source alone keeps a Host active", () => {
    expect(effectiveHostStatus({ manualGranted: true, microsoftManagerGranted: false })).toBe("active");
    expect(effectiveHostStatus({ manualGranted: false, microsoftManagerGranted: true })).toBe("active");
    expect(effectiveHostStatus({ manualGranted: true, microsoftManagerGranted: true })).toBe("active");
    expect(effectiveHostStatus({ manualGranted: false, microsoftManagerGranted: false })).toBe("revoked");
  });
});

describe("planManagerSync", () => {
  it("grants a confirmed manager who does not yet hold Microsoft authority", () => {
    const plan = planManagerSync([{ userId: "a", outcome: "manager" }], []);
    expect(plan.complete).toBe(true);
    expect(plan.toGrant).toEqual(["a"]);
    expect(plan.toRevoke).toEqual([]);
  });

  it("does NOT grant a non-manager", () => {
    const plan = planManagerSync([{ userId: "a", outcome: "not_manager" }], []);
    expect(plan.toGrant).toEqual([]);
    expect(plan.toRevoke).toEqual([]);
  });

  it("is idempotent — a re-run over an unchanged directory changes nothing", () => {
    const probes: ManagerProbe[] = [{ userId: "a", outcome: "manager" }];
    const plan = planManagerSync(probes, [synced("a")]);
    expect(plan.toGrant).toEqual([]);
    expect(plan.toRevoke).toEqual([]);
    expect(plan.unchanged).toEqual(["a"]);
  });

  it("revokes Microsoft authority when the directory stops confirming it", () => {
    const plan = planManagerSync([{ userId: "a", outcome: "not_manager" }], [synced("a")]);
    expect(plan.complete).toBe(true);
    expect(plan.toRevoke).toEqual(["a"]);
  });

  it("★ NEVER revokes a purely manual grant — this is the Founder", () => {
    /*
      The Founder holds a manual grant and has no Microsoft direct report, so every complete run
      sees them as "not a manager". They must not appear in toRevoke on any run, ever: the sync
      only ever clears authority it granted.
    */
    const plan = planManagerSync(
      [{ userId: "founder", outcome: "not_manager" }],
      [manual("founder")],
    );
    expect(plan.toRevoke).toEqual([]);
    expect(plan.toGrant).toEqual([]);
  });

  it("a founder absent from the probe set entirely is still never revoked", () => {
    const plan = planManagerSync([{ userId: "a", outcome: "manager" }], [manual("founder"), synced("a")]);
    expect(plan.toRevoke).toEqual([]);
  });

  it("someone holding BOTH loses only the Microsoft half", () => {
    const plan = planManagerSync([{ userId: "x", outcome: "not_manager" }], [both("x")]);
    // The plan names them; effectiveHostStatus is what keeps them active afterwards.
    expect(plan.toRevoke).toEqual(["x"]);
    expect(effectiveHostStatus({ manualGranted: true, microsoftManagerGranted: false })).toBe("active");
  });

  it("★ an INCOMPLETE run revokes nobody", () => {
    /*
      One unanswered probe and the whole revocation half is off. The accident this prevents: a Graph
      outage answering "not a manager" for everyone and stripping Host from every lead at once.
    */
    const plan = planManagerSync(
      [
        { userId: "a", outcome: "not_manager" },
        { userId: "b", outcome: "indeterminate" },
      ],
      [synced("a"), synced("b")],
    );
    expect(plan.complete).toBe(false);
    expect(plan.toRevoke).toEqual([]);
  });

  it("an incomplete run still GRANTS a positively confirmed manager", () => {
    const plan = planManagerSync(
      [
        { userId: "a", outcome: "manager" },
        { userId: "b", outcome: "indeterminate" },
      ],
      [],
    );
    expect(plan.complete).toBe(false);
    expect(plan.toGrant).toEqual(["a"]);
    expect(plan.toRevoke).toEqual([]);
  });

  it("a run in which EVERY probe failed revokes nobody", () => {
    const plan = planManagerSync(
      [
        { userId: "a", outcome: "indeterminate" },
        { userId: "b", outcome: "indeterminate" },
      ],
      [synced("a"), synced("b")],
    );
    expect(plan.toRevoke).toEqual([]);
    expect(plan.indeterminate).toEqual(["a", "b"]);
  });
});
