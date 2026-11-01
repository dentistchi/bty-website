import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertMatchingHistoricalFiles, historicalChangedFiles, parseHistoricalScope,
  pinnedLaterSourceMigrations, unpinnedMigrationSources,
} from "./repositoryScope";

const first = "ab8177e8e001c34b0da4c062b9773f025c7ccab5";
const raw = readFileSync(join(process.cwd(), "src/test-support/fixtures/historical-change-scopes.json"), "utf8");

describe("pinned repository-scope proof integrity", () => {
  it("retains independently retrieved exact, nonempty historical changed-file sets", () => {
    expect(historicalChangedFiles(first)).toEqual([
      "src/app/[locale]/today/legacyPortalContainment.test.ts", "src/app/[locale]/today/page.tsx",
    ]);
    expect(historicalChangedFiles("e71b3c84112ec9ac453fe2ef48d471cda17296f5")).toHaveLength(9);
    expect(historicalChangedFiles("1aa3d30784fa395a88f003c688379c15ea4e2183")).toHaveLength(7);
  });
  it("refuses missing/replaced commits and any changed fixture byte, including a vacuous list", () => {
    expect(() => parseHistoricalScope(raw, "f".repeat(40))).toThrow(/Unknown historical commit/);
    expect(() => parseHistoricalScope(raw.replace("page.tsx", "page-other.tsx"), first)).toThrow(/fixture bytes changed/);
    const empty = JSON.parse(raw); empty.snapshots[0].files = [];
    expect(() => parseHistoricalScope(JSON.stringify(empty), first)).toThrow(/fixture bytes changed/);
  });
  it("compares available local history exactly instead of silently using a contradictory fixture", () => {
    expect(() => assertMatchingHistoricalFiles(["src/a.ts"], ["src/a.ts", "supabase/migrations/unexpected.sql"])).toThrow(/disagrees/);
    expect(() => assertMatchingHistoricalFiles(["src/a.ts"], [])).toThrow(/disagrees/);
  });
  it("checks the bytes of all 26 observed later migrations without applying any SQL", () => {
    const names = pinnedLaterSourceMigrations();
    expect(names).toHaveLength(26);
    expect(names).toContain("20261031222747_legacy_xp_atomic_reward_receipts.sql");
    expect(names).toContain("20261101120000_reward_write_fence_v1.sql");
    expect(names).toContain("20261101130000_weekly_reflection_quest_atomic.sql");
    expect(names).toContain("20261101140000_shared_reward_write_fence.sql");
    expect(unpinnedMigrationSources(names)).toEqual([]);
  });
  it("leaves an unregistered future migration visible to every empty-list guard", () => {
    expect(unpinnedMigrationSources(["20990101000000_unregistered.sql"])).toEqual(["20990101000000_unregistered.sql"]);
  });
  it("refuses modified registered SQL even though its filename was previously observed", () => {
    let changed = false;
    expect(() => pinnedLaterSourceMigrations(process.cwd(), path => {
      const bytes = readFileSync(path);
      if (!changed) { changed = true; return Buffer.concat([bytes, Buffer.from("\n-- changed")]); }
      return bytes;
    })).toThrow(/Pinned migration source changed/);
  });
});
