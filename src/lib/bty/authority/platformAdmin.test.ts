import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * BTY platform-admin authority, and the capability it inherits.
 *
 * ★ THE CLAIM UNDER TEST: an active platform admin can Track with BTY WITHOUT a Foundry Host
 * grant, without the Microsoft Manager Authority migration, and without Graph credentials. Those
 * are separate authority sources with their own failure modes, and an admin must not be locked out
 * by any of them.
 *
 * The refusals are asserted at least as hard as the grants, because this is the predicate that
 * decides who may act on other people's work: an email must grant nothing, a forged
 * `user_metadata` claim must grant nothing, and a database that cannot be read must grant nothing.
 */

const isActiveFoundryHost = vi.fn();
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({
  isActiveFoundryHost: (...a: unknown[]) => isActiveFoundryHost(...a),
}));

import { isActivePlatformAdmin, canTrackWithBty } from "./platformAdmin.server";

const ADMIN = "18b1ee80-0000-0000-0000-000000000001";
const HOST = "81f08aa1-0000-0000-0000-000000000002";
const PLAIN = "aaaaaaaa-0000-0000-0000-000000000003";

/** A Supabase double that records exactly which table was asked, and answers only that one. */
function db(grants: Record<string, { status: string }>, opts: { error?: { code: string }; throws?: boolean } = {}) {
  const tables: string[] = [];
  const client = {
    tables,
    from(table: string) {
      tables.push(table);
      return {
        select: () => ({
          eq: (_c: string, userId: string) => ({
            maybeSingle: async () => {
              if (opts.throws) throw new Error("connection reset");
              if (opts.error) return { data: null, error: opts.error };
              return { data: grants[userId] ?? null, error: null };
            },
          }),
        }),
      };
    },
  };
  return client as unknown as Parameters<typeof isActivePlatformAdmin>[0] & { tables: string[] };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  isActiveFoundryHost.mockResolvedValue(false);
});

describe("isActivePlatformAdmin — the source of truth is one row", () => {
  it("★ an ACTIVE grant is an admin", async () => {
    expect(await isActivePlatformAdmin(db({ [ADMIN]: { status: "active" } }), ADMIN)).toBe(true);
  });

  it("★ a REVOKED grant is not", async () => {
    expect(await isActivePlatformAdmin(db({ [ADMIN]: { status: "revoked" } }), ADMIN)).toBe(false);
  });

  it("no row at all is not", async () => {
    expect(await isActivePlatformAdmin(db({}), PLAIN)).toBe(false);
  });

  it("★ a database ERROR fails CLOSED", async () => {
    expect(await isActivePlatformAdmin(db({}, { error: { code: "42P01" } }), ADMIN)).toBe(false);
  });

  it("★ a thrown lookup fails CLOSED — including the table not existing yet", async () => {
    expect(await isActivePlatformAdmin(db({}, { throws: true }), ADMIN)).toBe(false);
  });

  it("a missing user id is not an admin, and never reaches the database", async () => {
    const c = db({});
    expect(await isActivePlatformAdmin(c, null)).toBe(false);
    expect(await isActivePlatformAdmin(c, undefined)).toBe(false);
    expect(await isActivePlatformAdmin(c, "")).toBe(false);
    expect(c.tables).toEqual([]);
  });

  it("★ reads ONLY bty_platform_admin_grants — no membership, no identity, no email table", async () => {
    const c = db({ [ADMIN]: { status: "active" } });
    await isActivePlatformAdmin(c, ADMIN);
    expect(c.tables).toEqual(["bty_platform_admin_grants"]);
  });

  it("★ an error never leaks the roster into the log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await isActivePlatformAdmin(db({}, { error: { code: "42501" } }), ADMIN);
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).toContain("42501");
    expect(logged).not.toContain(ADMIN);
  });
});

describe("★ canTrackWithBty — admin inherits Host capability", () => {
  it("★ 1+2. an active admin can track, with NO Foundry Host grant at all", async () => {
    isActiveFoundryHost.mockResolvedValue(false);
    expect(await canTrackWithBty(db({ [ADMIN]: { status: "active" } }), ADMIN)).toBe(true);
  });

  it("★ 3. the admin path never consults the Host table — so it cannot be blocked by it", async () => {
    isActiveFoundryHost.mockRejectedValue(new Error("foundry_host_grants unavailable"));
    expect(await canTrackWithBty(db({ [ADMIN]: { status: "active" } }), ADMIN)).toBe(true);
    expect(isActiveFoundryHost).not.toHaveBeenCalled();
  });

  it("★ 4+5. admin works with NO manager-authority provenance columns and NO Graph config", async () => {
    // The provenance migration (20260903000000) is unapplied and MS_GRAPH_* / AZURE_AD_* are unset
    // in production. Neither is an input to this function, which is the point.
    delete process.env.MS_GRAPH_CLIENT_ID;
    delete process.env.AZURE_AD_CLIENT_ID;
    isActiveFoundryHost.mockResolvedValue(false);
    expect(await canTrackWithBty(db({ [ADMIN]: { status: "active" } }), ADMIN)).toBe(true);
  });

  it("★ 6. a manual Host with no admin grant still tracks", async () => {
    isActiveFoundryHost.mockResolvedValue(true);
    expect(await canTrackWithBty(db({}), HOST)).toBe(true);
  });

  it("★ 7. an ordinary participant — neither admin nor host — cannot track", async () => {
    isActiveFoundryHost.mockResolvedValue(false);
    expect(await canTrackWithBty(db({}), PLAIN)).toBe(false);
  });

  it("★ 8. a REVOKED admin loses the inherited capability unless independently a Host", async () => {
    isActiveFoundryHost.mockResolvedValue(false);
    expect(await canTrackWithBty(db({ [ADMIN]: { status: "revoked" } }), ADMIN)).toBe(false);
    isActiveFoundryHost.mockResolvedValue(true);
    expect(await canTrackWithBty(db({ [ADMIN]: { status: "revoked" } }), ADMIN)).toBe(true);
  });

  it("a database failure on the admin lookup still lets a genuine Host through", async () => {
    isActiveFoundryHost.mockResolvedValue(true);
    expect(await canTrackWithBty(db({}, { throws: true }), HOST)).toBe(true);
  });

  it("★ a total failure of BOTH sources denies", async () => {
    isActiveFoundryHost.mockResolvedValue(false);
    expect(await canTrackWithBty(db({}, { throws: true }), PLAIN)).toBe(false);
  });
});

describe("★ what must NEVER grant authority", () => {
  it("★ 9. an email is not an input — the function's only identity argument is a user id", async () => {
    const src = (await import("node:fs")).readFileSync("src/lib/bty/authority/platformAdmin.server.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bemail\b/i);
    expect(code).not.toMatch(/BTY_ADMIN_EMAILS/);
  });

  it("★ 10. user_metadata / raw_user_meta_data are never read", async () => {
    const src = (await import("node:fs")).readFileSync("src/lib/bty/authority/platformAdmin.server.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/user_metadata|raw_user_meta_data|app_metadata/);
  });

  it("★ 11. Microsoft directory roles are never read", async () => {
    const src = (await import("node:fs")).readFileSync("src/lib/bty/authority/platformAdmin.server.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/roles|directory|graph|Graph/);
  });

  it("★ 12. a forged admin claim on the user object grants nothing — it is not an argument", async () => {
    // The only way to express "this user" is the canonical id. There is no object to forge.
    const forged = { id: PLAIN, email: "hc@bty-dso.com", user_metadata: { is_admin: true, roles: ["bty_admin"] } };
    isActiveFoundryHost.mockResolvedValue(false);
    expect(await canTrackWithBty(db({}), forged.id)).toBe(false);
  });

  it("★ 13. a different canonical id — a wrong tenant/AAD binding — gets nothing", async () => {
    isActiveFoundryHost.mockResolvedValue(false);
    // The admin grant exists, but this is not that user.
    expect(await canTrackWithBty(db({ [ADMIN]: { status: "active" } }), PLAIN)).toBe(false);
  });
});

describe("★ the legacy email gate is gone from authorization", () => {
  it("authz.ts contains no email comparison in its admin path", async () => {
    const src = (await import("node:fs")).readFileSync("src/lib/authz.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/ADMIN_EMAIL_SET|ADMIN_EMAILS_RAW|process\.env\.BTY_ADMIN_EMAILS/);
    // ...and the admin predicate now resolves a canonical grant.
    expect(code).toMatch(/isActivePlatformAdmin/);
  });

  it("★ the fail-OPEN branch is gone — an unset allowlist can no longer admit everyone", async () => {
    const src = (await import("node:fs")).readFileSync("src/lib/authz.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/ADMIN_EMAIL_SET\.size === 0/);
  });

  it("the admin console and the QA preview no longer read an email allowlist", async () => {
    const fs = await import("node:fs");
    for (const p of ["src/app/[locale]/admin/layout.tsx", "src/app/[locale]/train/day/[day]/page.tsx"]) {
      const code = fs.readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code, p).not.toMatch(/process\.env\.BTY_ADMIN_EMAILS/);
      expect(code, p).toMatch(/isActivePlatformAdmin/);
    }
  });
});
