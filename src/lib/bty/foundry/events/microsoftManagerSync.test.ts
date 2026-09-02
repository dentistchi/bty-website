import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { makeFakeHostAdmin } from "./fakeHostGrantsAdmin.testkit";

/**
 * The Microsoft manager sync (Microsoft Manager Authority V1).
 *
 * The claims that matter: a manager gets Host, a plain employee does not, a re-run changes
 * nothing, and NO failure mode can revoke anybody. The Founder — a manual Host with no direct
 * report — survives every one of these runs.
 */

const graphConfigFromEnv = vi.fn();
const getGraphAppToken = vi.fn();
const probeDirectReports = vi.fn();

vi.mock("@/lib/bty/microsoft/graphDirectory.server", () => ({
  graphConfigFromEnv: () => graphConfigFromEnv(),
  getGraphAppToken: (...a: unknown[]) => getGraphAppToken(...a),
  probeDirectReports: (...a: unknown[]) => probeDirectReports(...a),
  REQUIRED_GRAPH_APPLICATION_PERMISSIONS: ["User.Read.All"],
}));

const TENANT = "11111111-1111-1111-1111-111111111111";
const OTHER_TENANT = "99999999-9999-9999-9999-999999999999";
const FOUNDER = "81f08aa1-44a2-40b1-9190-7866151461a7";
const LEAD = "aaaaaaaa-0000-0000-0000-000000000001";
const STAFF = "bbbbbbbb-0000-0000-0000-000000000002";
const oidFor = (n: number) => `2222222${n}-2222-2222-2222-222222222222`;

async function sync(admin: Parameters<typeof import("./microsoftManagerSync.server").syncMicrosoftManagers>[0]) {
  const mod = await import("./microsoftManagerSync.server");
  return mod.syncMicrosoftManagers(admin);
}

function linked(entries: Array<{ user_id: string; oid: string; tenant?: string }>) {
  return {
    data: entries.map((e) => ({
      user_id: e.user_id,
      tenant_id: e.tenant ?? TENANT,
      aad_object_id: e.oid,
    })),
    error: null,
  };
}

/** A manual Host with no Microsoft direct report — the live production shape. */
const founderSeed = [
  { user_id: FOUNDER, status: "active" as const, manual_granted: true, microsoft_manager_granted: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  graphConfigFromEnv.mockReturnValue({ tenantId: TENANT, clientId: "c", clientSecret: "s" });
  getGraphAppToken.mockResolvedValue("tok");
});

describe("entitlement", () => {
  it("an activated manager becomes an active Host", async () => {
    const fake = makeFakeHostAdmin(founderSeed);
    fake.onRpc("bty_list_microsoft_linked_users", () => linked([{ user_id: LEAD, oid: oidFor(1) }]));
    probeDirectReports.mockResolvedValue({ ok: true, hasDirectReports: true });

    const r = await sync(fake.admin);
    expect(r).toMatchObject({ ok: true, complete: true, managers: 1, granted: [LEAD], revoked: [] });
    expect(fake.row(LEAD)).toMatchObject({ status: "active", microsoft_manager_granted: true, manual_granted: false });
  });

  it("a plain employee does NOT become a Host, and gets no row", async () => {
    const fake = makeFakeHostAdmin(founderSeed);
    fake.onRpc("bty_list_microsoft_linked_users", () => linked([{ user_id: STAFF, oid: oidFor(2) }]));
    probeDirectReports.mockResolvedValue({ ok: true, hasDirectReports: false });

    const r = await sync(fake.admin);
    expect(r).toMatchObject({ ok: true, complete: true, managers: 0, granted: [], revoked: [] });
    expect(fake.row(STAFF)).toBeUndefined();
  });

  it("★ a wrong-tenant identity never reaches Graph and never becomes a manager", async () => {
    const fake = makeFakeHostAdmin(founderSeed);
    fake.onRpc("bty_list_microsoft_linked_users", () =>
      linked([{ user_id: STAFF, oid: oidFor(3), tenant: OTHER_TENANT }]),
    );
    const r = await sync(fake.admin);
    expect(probeDirectReports).not.toHaveBeenCalled();
    expect(r.granted).toEqual([]);
    expect(fake.row(STAFF)).toBeUndefined();
  });

  it("re-running over an unchanged directory changes nothing", async () => {
    const fake = makeFakeHostAdmin(founderSeed);
    fake.onRpc("bty_list_microsoft_linked_users", () => linked([{ user_id: LEAD, oid: oidFor(1) }]));
    probeDirectReports.mockResolvedValue({ ok: true, hasDirectReports: true });

    await sync(fake.admin);
    const second = await sync(fake.admin);
    expect(second).toMatchObject({ granted: [], revoked: [], unchanged: 1 });
    expect(fake.rows.filter((r) => r.user_id === LEAD)).toHaveLength(1);
  });

  it("a manager who stops managing loses Microsoft-derived Host", async () => {
    const fake = makeFakeHostAdmin([
      ...founderSeed,
      { user_id: LEAD, status: "active" as const, manual_granted: false, microsoft_manager_granted: true },
    ]);
    fake.onRpc("bty_list_microsoft_linked_users", () => linked([{ user_id: LEAD, oid: oidFor(1) }]));
    probeDirectReports.mockResolvedValue({ ok: true, hasDirectReports: false });

    const r = await sync(fake.admin);
    expect(r).toMatchObject({ complete: true, revoked: [LEAD] });
    expect(fake.row(LEAD)).toMatchObject({ status: "revoked", microsoft_manager_granted: false });
  });
});

describe("★ the Founder survives every run", () => {
  const cases: Array<[string, () => void]> = [
    ["a clean complete run", () => probeDirectReports.mockResolvedValue({ ok: true, hasDirectReports: false })],
    ["a Graph outage", () => probeDirectReports.mockResolvedValue({ ok: false, reason: "http_error" })],
    ["a thrown probe", () => probeDirectReports.mockRejectedValue(new Error("boom"))],
  ];

  for (const [name, arrange] of cases) {
    it(`stays an active Host through ${name}`, async () => {
      const fake = makeFakeHostAdmin(founderSeed);
      fake.onRpc("bty_list_microsoft_linked_users", () =>
        linked([
          { user_id: FOUNDER, oid: oidFor(0) },
          { user_id: LEAD, oid: oidFor(1) },
        ]),
      );
      arrange();
      try {
        await sync(fake.admin);
      } catch {
        /* a throw must still not have revoked anyone — asserted below */
      }
      expect(fake.row(FOUNDER)).toMatchObject({ status: "active", manual_granted: true });
    });
  }
});

describe("★ revocation safety", () => {
  const managerSeed = [
    ...founderSeed,
    { user_id: LEAD, status: "active" as const, manual_granted: false, microsoft_manager_granted: true },
  ];
  const twoUsers = () =>
    linked([
      { user_id: LEAD, oid: oidFor(1) },
      { user_id: STAFF, oid: oidFor(2) },
    ]);

  it("a missing Graph configuration revokes nobody", async () => {
    const fake = makeFakeHostAdmin(managerSeed);
    fake.onRpc("bty_list_microsoft_linked_users", twoUsers);
    graphConfigFromEnv.mockReturnValue(null);

    const r = await sync(fake.admin);
    expect(r).toMatchObject({ ok: false, complete: false, reason: "no_graph_config", revoked: [] });
    expect(fake.row(LEAD)).toMatchObject({ status: "active", microsoft_manager_granted: true });
  });

  it("an unobtainable token revokes nobody", async () => {
    const fake = makeFakeHostAdmin(managerSeed);
    fake.onRpc("bty_list_microsoft_linked_users", twoUsers);
    getGraphAppToken.mockResolvedValue(null);

    const r = await sync(fake.admin);
    expect(r).toMatchObject({ ok: false, reason: "no_token", revoked: [] });
    expect(fake.row(LEAD)).toMatchObject({ status: "active" });
    expect(probeDirectReports).not.toHaveBeenCalled();
  });

  it("an unreadable user list revokes nobody", async () => {
    const fake = makeFakeHostAdmin(managerSeed);
    // No handler registered -> the RPC errors.
    const r = await sync(fake.admin);
    expect(r).toMatchObject({ ok: false, reason: "directory_unavailable", revoked: [] });
    expect(fake.row(LEAD)).toMatchObject({ status: "active" });
  });

  it("a TOTAL Graph failure revokes nobody", async () => {
    const fake = makeFakeHostAdmin(managerSeed);
    fake.onRpc("bty_list_microsoft_linked_users", twoUsers);
    probeDirectReports.mockResolvedValue({ ok: false, reason: "http_error" });

    const r = await sync(fake.admin);
    expect(r).toMatchObject({ ok: true, complete: false, revoked: [], indeterminate: 2 });
    expect(fake.row(LEAD)).toMatchObject({ status: "active", microsoft_manager_granted: true });
  });

  it("★ a PARTIAL result revokes nobody — even the person who answered 'no'", async () => {
    /*
      The subtle one. LEAD answered a clean "no direct reports" and would be revoked on a complete
      run; STAFF's probe failed. One unanswered probe disables the revocation half entirely, so
      LEAD keeps Host until a run that actually saw the whole picture.
    */
    const fake = makeFakeHostAdmin(managerSeed);
    fake.onRpc("bty_list_microsoft_linked_users", twoUsers);
    probeDirectReports
      .mockResolvedValueOnce({ ok: true, hasDirectReports: false })
      .mockResolvedValueOnce({ ok: false, reason: "http_error" });

    const r = await sync(fake.admin);
    expect(r).toMatchObject({ complete: false, revoked: [], indeterminate: 1 });
    expect(fake.row(LEAD)).toMatchObject({ status: "active", microsoft_manager_granted: true });
  });

  it("a partial run still GRANTS the manager it positively confirmed", async () => {
    const fake = makeFakeHostAdmin(founderSeed);
    fake.onRpc("bty_list_microsoft_linked_users", twoUsers);
    probeDirectReports
      .mockResolvedValueOnce({ ok: true, hasDirectReports: true })
      .mockResolvedValueOnce({ ok: false, reason: "network" });

    const r = await sync(fake.admin);
    expect(r).toMatchObject({ complete: false, granted: [LEAD], revoked: [] });
  });
});

describe("the sync cannot create identity", () => {
  it("★ never touches auth.users, and never joins on email", () => {
    /*
      Scans CODE, not prose. The module's header deliberately says in words that it uses no email,
      no UPN and no jobTitle — a scan that read comments would fail on its own documentation and
      the only way to pass would be to delete the explanation. Comments are stripped so the
      assertion is about what actually executes.
    */
    const raw = fs.readFileSync(
      path.join(process.cwd(), "src/lib/bty/foundry/events/microsoftManagerSync.server.ts"),
      "utf8",
    );
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The stripper must not have eaten the code, or every assertion below would pass vacuously.
    expect(src).toContain("setMicrosoftManagerGrant");
    expect(src).toContain("probeDirectReports");
    expect(src.length).toBeGreaterThan(1000);
    for (const forbidden of [
      "auth.admin",
      "createUser",
      "inviteUserByEmail",
      "generateLink",
      "email",
      "userPrincipalName",
      "jobTitle",
      "displayName",
      "department",
    ]) {
      expect(src.includes(forbidden), `must not reference ${forbidden}`).toBe(false);
    }
  });

  it("an oid with no BTY account is simply absent from the run", async () => {
    // The linked-user RPC only returns people who already have an auth.users row, so an upstream
    // manager who has never activated cannot appear here at all.
    const fake = makeFakeHostAdmin(founderSeed);
    fake.onRpc("bty_list_microsoft_linked_users", () => linked([]));
    const r = await sync(fake.admin);
    expect(r).toMatchObject({ ok: true, complete: true, examined: 0, granted: [], revoked: [] });
    expect(fake.rows).toHaveLength(1);
  });
});
