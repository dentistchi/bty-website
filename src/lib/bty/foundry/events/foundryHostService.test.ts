import { describe, it, expect } from "vitest";
import {
  isActiveFoundryHost,
  getFoundryHostStatus,
  grantFoundryHost,
  revokeFoundryHost,
  setMicrosoftManagerGrant,
  listHostGrantStates,
  readHostGrantState,
} from "./foundryHostService";
import { makeFakeHostAdmin } from "./fakeHostGrantsAdmin.testkit";

const U = "user-1";
const ADMIN_ACTOR = "admin-9";

describe("foundry host grants — manual authority (unchanged behaviour)", () => {
  it("a fresh user is not a host", async () => {
    const { admin } = makeFakeHostAdmin();
    expect(await isActiveFoundryHost(admin, U)).toBe(false);
    expect(await getFoundryHostStatus(admin, U)).toBe("none");
  });

  it("grant makes an active host (idempotent)", async () => {
    const { admin, rows } = makeFakeHostAdmin();
    expect((await grantFoundryHost(admin, U, ADMIN_ACTOR)).ok).toBe(true);
    expect(await isActiveFoundryHost(admin, U)).toBe(true);
    expect(await getFoundryHostStatus(admin, U)).toBe("active");
    await grantFoundryHost(admin, U, ADMIN_ACTOR);
    expect(rows).toHaveLength(1);
    expect(await isActiveFoundryHost(admin, U)).toBe(true);
  });

  it("revoke removes host operation but keeps the row (idempotent)", async () => {
    const { admin, rows, row } = makeFakeHostAdmin();
    await grantFoundryHost(admin, U, ADMIN_ACTOR);

    const r1 = await revokeFoundryHost(admin, U);
    expect(r1).toEqual({ ok: true, changed: true, stillActiveViaMicrosoft: false });
    expect(await isActiveFoundryHost(admin, U)).toBe(false);
    expect(await getFoundryHostStatus(admin, U)).toBe("revoked");
    expect(rows).toHaveLength(1);
    expect(row(U)?.revoked_at).toBeTruthy();

    const r2 = await revokeFoundryHost(admin, U);
    expect(r2).toEqual({ ok: true, changed: false, stillActiveViaMicrosoft: false });
  });

  it("revoking a never-granted user is a no-op success", async () => {
    const { admin } = makeFakeHostAdmin();
    expect(await revokeFoundryHost(admin, U)).toEqual({
      ok: true,
      changed: false,
      stillActiveViaMicrosoft: false,
    });
  });

  it("re-granting a revoked user reactivates and clears revoked_at", async () => {
    const { admin, rows, row } = makeFakeHostAdmin();
    await grantFoundryHost(admin, U, ADMIN_ACTOR);
    await revokeFoundryHost(admin, U);
    await grantFoundryHost(admin, U, ADMIN_ACTOR);
    expect(await isActiveFoundryHost(admin, U)).toBe(true);
    expect(row(U)?.revoked_at).toBeNull();
    expect(rows).toHaveLength(1);
  });
});

describe("provenance — the two sources never overwrite each other", () => {
  it("a manual grant preserves an existing Microsoft flag", async () => {
    const { admin, row } = makeFakeHostAdmin();
    await setMicrosoftManagerGrant(admin, U, true);
    await grantFoundryHost(admin, U, ADMIN_ACTOR);
    expect(row(U)?.manual_granted).toBe(true);
    expect(row(U)?.microsoft_manager_granted).toBe(true);
    expect(row(U)?.status).toBe("active");
  });

  it("a Microsoft grant preserves an existing manual flag", async () => {
    const { admin, row } = makeFakeHostAdmin();
    await grantFoundryHost(admin, U, ADMIN_ACTOR);
    await setMicrosoftManagerGrant(admin, U, true);
    expect(row(U)?.manual_granted).toBe(true);
    expect(row(U)?.microsoft_manager_granted).toBe(true);
  });

  it("★ clearing Microsoft entitlement leaves a manual Host ACTIVE", async () => {
    /*
      The Founder case, at the write layer. Microsoft says they manage nobody; their standing
      authority must survive that, and `status` must stay 'active' so all 31 gates still pass.
    */
    const { admin, row } = makeFakeHostAdmin();
    await grantFoundryHost(admin, U, ADMIN_ACTOR);
    await setMicrosoftManagerGrant(admin, U, true);

    await setMicrosoftManagerGrant(admin, U, false);
    expect(row(U)?.microsoft_manager_granted).toBe(false);
    expect(row(U)?.manual_granted).toBe(true);
    expect(row(U)?.status).toBe("active");
    expect(await isActiveFoundryHost(admin, U)).toBe(true);
  });

  it("clearing Microsoft entitlement from a synced-only Host revokes them", async () => {
    const { admin, row } = makeFakeHostAdmin();
    await setMicrosoftManagerGrant(admin, U, true);
    expect(await isActiveFoundryHost(admin, U)).toBe(true);

    await setMicrosoftManagerGrant(admin, U, false);
    expect(await isActiveFoundryHost(admin, U)).toBe(false);
    expect(row(U)?.status).toBe("revoked");
    expect(row(U)?.revoked_at).toBeTruthy();
  });

  it("manually revoking someone Microsoft still confirms leaves them an active Host", async () => {
    const { admin, row } = makeFakeHostAdmin();
    await grantFoundryHost(admin, U, ADMIN_ACTOR);
    await setMicrosoftManagerGrant(admin, U, true);

    expect(await revokeFoundryHost(admin, U)).toEqual({
      ok: true,
      changed: true,
      stillActiveViaMicrosoft: true,
    });
    expect(row(U)?.manual_granted).toBe(false);
    expect(await isActiveFoundryHost(admin, U)).toBe(true);
  });

  it("★ a non-manager with no grant gets NO ROW — the sync does not fill the table with revocations", async () => {
    const { admin, rows } = makeFakeHostAdmin();
    const r = await setMicrosoftManagerGrant(admin, U, false);
    expect(r).toEqual({ ok: true, changed: false });
    expect(rows).toHaveLength(0);
  });

  it("re-granting the same Microsoft entitlement is idempotent and stamps freshness", async () => {
    const { admin, rows, row } = makeFakeHostAdmin();
    await setMicrosoftManagerGrant(admin, U, true);
    const first = row(U)?.microsoft_manager_synced_at;
    const again = await setMicrosoftManagerGrant(admin, U, true);
    expect(again).toEqual({ ok: true, changed: false });
    expect(rows).toHaveLength(1);
    expect(row(U)?.microsoft_manager_synced_at).toBeTruthy();
    expect(first).toBeTruthy();
  });

  it("reads provenance back for the planner", async () => {
    const { admin } = makeFakeHostAdmin();
    await grantFoundryHost(admin, "a", null);
    await setMicrosoftManagerGrant(admin, "b", true);

    expect(await readHostGrantState(admin, "a")).toMatchObject({
      userId: "a",
      manualGranted: true,
      microsoftManagerGranted: false,
    });
    const all = await listHostGrantStates(admin);
    expect(all).toEqual(
      expect.arrayContaining([
        { userId: "a", manualGranted: true, microsoftManagerGranted: false },
        { userId: "b", manualGranted: false, microsoftManagerGranted: true },
      ]),
    );
  });
});
