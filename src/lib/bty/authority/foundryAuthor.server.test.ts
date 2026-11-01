import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasFoundryAuthorCapability } from "./foundryAuthor.server";

type Tables = Partial<Record<"bty_platform_admin_grants" | "foundry_host_grants" | "bty_microsoft_directory_authority", Record<string, unknown> | null>>;

function authorityDb(tables: Tables, failedTable?: keyof Tables, reads: string[] = []) {
  return {
    from(table: keyof Tables) {
      reads.push(table);
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
const microsoft = (is_provider: boolean, is_manager = false): Tables => ({ bty_microsoft_directory_authority: { is_provider, is_manager, sync_status: "success", account_enabled: true, user_type: "Member" } });

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

describe("hasFoundryAuthorCapability", () => {
  it("grants successful Microsoft provider or manager snapshots", async () => {
    expect(await hasFoundryAuthorCapability(authorityDb(microsoft(true)), userId)).toBe(true);
    expect(await hasFoundryAuthorCapability(authorityDb(microsoft(false, true)), userId)).toBe(true);
  });

  it("preserves platform-admin and explicit Foundry Host exception authority", async () => {
    expect(await hasFoundryAuthorCapability(authorityDb({ bty_platform_admin_grants: { status: "active" } }), userId)).toBe(true);
    expect(await hasFoundryAuthorCapability(authorityDb({ foundry_host_grants: { status: "active" } }), userId)).toBe(true);
  });

  it("does not grant automatic authority from absent or indeterminate snapshots", async () => {
    expect(await hasFoundryAuthorCapability(authorityDb({}), userId)).toBe(false);
    expect(await hasFoundryAuthorCapability(authorityDb({ bty_microsoft_directory_authority: { is_provider: true, is_manager: false, sync_status: "indeterminate" } }), userId)).toBe(false);
  });

  it("never derives authority from display name, email, title, or metadata", async () => {
    const source = await import("node:fs").then((fs) => fs.readFileSync("src/lib/bty/authority/foundryAuthor.server.ts", "utf8"));
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["email", "displayname", "title", "user_metadata", "raw_user_meta_data", "preferred_username"]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it.each(["bty_platform_admin_grants", "foundry_host_grants", "bty_microsoft_directory_authority"] as const)(
    "fails closed when %s cannot be read",
    async (failedTable) => {
      const tables: Tables = failedTable === "bty_microsoft_directory_authority" ? microsoft(true)
        : { [failedTable]: { status: "active" } };
      const reads: string[] = [];
      // The identical source would grant without the injected database error.
      // A misspelled/unread table can no longer make this denial pass vacuously.
      expect(await hasFoundryAuthorCapability(authorityDb(tables), userId)).toBe(true);
      expect(await hasFoundryAuthorCapability(authorityDb(tables, failedTable, reads), userId)).toBe(false);
      expect(reads).toContain(failedTable);
    },
  );
});
