import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasFoundryAuthorCapability } from "./foundryAuthor.server";

type Tables = Partial<Record<"bty_platform_admin_grants" | "foundry_host_grants" | "bty_org_memberships" | "memberships" | "workforce_profiles", Record<string, unknown> | null>>;

function authorityDb(tables: Tables, failedTable?: keyof Tables) {
  return {
    from(table: keyof Tables) {
      return {
        select() {
          return {
            eq() {
              return this;
            },
            async maybeSingle() {
              if (table === failedTable) return { data: null, error: { code: "XX001" } };
              return { data: tables[table] ?? null, error: null };
            },
          };
        },
      };
    },
  } as never;
}

const userId = "user-1";
const canonical = (primary_role_key: string | null): Tables => ({ bty_org_memberships: { primary_role_key } });
const legacy = (role: string): Tables => ({ memberships: { role } });

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

describe("hasFoundryAuthorCapability", () => {
  it.each(["GENERAL_DENTIST", "ORTHODONTIST", "OFFICE_MANAGER", "AREA_MANAGER", "STATE_REGIONAL_DIRECTOR"])(
    "grants eligible canonical role %s",
    async (primary_role_key) => {
      expect(await hasFoundryAuthorCapability(authorityDb(canonical(primary_role_key)), userId)).toBe(true);
    },
  );

  it.each(["DENTAL_ASSISTANT", "OFFICE_ADMIN", "DSO_OPERATIONS_MEMBER", "SSO_SUPPORT_SPECIALIST"])(
    "denies canonical non-author role %s",
    async (primary_role_key) => {
      expect(await hasFoundryAuthorCapability(authorityDb(canonical(primary_role_key)), userId)).toBe(false);
    },
  );

  it("preserves platform-admin and explicit Foundry Host exception authority", async () => {
    expect(await hasFoundryAuthorCapability(authorityDb({ bty_platform_admin_grants: { status: "active" } }), userId)).toBe(true);
    expect(await hasFoundryAuthorCapability(authorityDb({ foundry_host_grants: { status: "active" } }), userId)).toBe(true);
  });

  it.each(["doctor", "office_manager", "regional_manager"])(
    "uses structured legacy %s only when canonical identity is unknown",
    async (role) => {
      expect(await hasFoundryAuthorCapability(authorityDb({ ...canonical(null), ...legacy(role) }), userId)).toBe(true);
    },
  );

  it("does not let stale legacy doctor data override a known canonical assistant", async () => {
    expect(await hasFoundryAuthorCapability(authorityDb({ ...canonical("DENTAL_ASSISTANT"), ...legacy("doctor") }), userId)).toBe(false);
  });

  it("uses existing structured SSO manager semantics only after unknown canonical identity", async () => {
    expect(await hasFoundryAuthorCapability(authorityDb({ ...canonical(null), workforce_profiles: { team: "sso", sso_level: "manager" } }), userId)).toBe(true);
    expect(await hasFoundryAuthorCapability(authorityDb({ ...canonical(null), workforce_profiles: { team: "sso", sso_level: "staff" } }), userId)).toBe(false);
  });

  it("never derives authority from display name, email, title, or metadata", async () => {
    const source = await import("node:fs").then((fs) => fs.readFileSync("src/lib/bty/authority/foundryAuthor.server.ts", "utf8"));
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["email", "displayname", "title", "user_metadata", "raw_user_meta_data", "preferred_username"]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it.each(["bty_platform_admin_grants", "foundry_host_grants", "bty_org_memberships", "memberships", "workforce_profiles"] as const)(
    "fails closed when %s cannot be read",
    async (failedTable) => {
      expect(await hasFoundryAuthorCapability(authorityDb(canonical(null), failedTable), userId)).toBe(false);
    },
  );
});
