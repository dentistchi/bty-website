import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SCENARIOS } from "@/lib/bty/scenario/legacy/bundledScenarios";
import { getScenarioById, scenarioList } from "@/data/scenario";
import { getEliteScenarioById, eliteScenarioToScenario, getEliteScenarioCatalogMetas } from "@/lib/bty/arena/eliteScenariosCanonical.server";
import {
  CUTOVER_MIGRATIONS,
  FENCED_TABLES,
  FENCE_TRIGGERS,
  buildApplyBundle,
  buildPauseBundle,
  buildRemoveFenceBundle,
  buildResumeBundle,
  readCutoverSources,
} from "../../../../scripts/reward-write-fence-cutover.mjs";

const ROOT = path.resolve(__dirname, "../../../..");
const FENCE_SQL = readFileSync(path.join(ROOT, "supabase/migrations/20261101120000_reward_write_fence_v1.sql"), "utf8");
const SHARED_SQL = readFileSync(path.join(ROOT, "supabase/migrations/20261101140000_shared_reward_write_fence.sql"), "utf8");
const ALL_FENCE_SQL = `${FENCE_SQL}\n${SHARED_SQL}`;

function fencedCatalog(): string[] {
  const body = FENCE_SQL.slice(FENCE_SQL.indexOf("any (array["), FENCE_SQL.indexOf("]::text[])"));
  return [...body.matchAll(/'([^']+)'/g)].map(m => m[1]);
}

describe("reward write fence source contract", () => {
  it("fences exactly the bundled legacy catalog the old /api/arena/event route paid for", () => {
    expect(fencedCatalog().sort()).toEqual(SCENARIOS.map(s => s.scenarioId).sort());
  });

  it("never fences a canonical or elite /api/arena/choice scenario ID", () => {
    const canonical = new Set<string>();
    for (const id of scenarioList) {
      canonical.add(id);
      const db = getScenarioById(id, "en")?.dbScenarioId;
      if (db) canonical.add(db);
    }
    for (const meta of getEliteScenarioCatalogMetas()) {
      canonical.add(meta.scenarioId);
      // Catalog metas also list non-chain IDs that getEliteScenarioById refuses by design.
      try {
        const db = eliteScenarioToScenario(getEliteScenarioById(meta.scenarioId), "en").dbScenarioId;
        if (db) canonical.add(db);
      } catch (error) {
        expect(String(error)).toContain("forbidden_scenario_id");
      }
    }
    expect(canonical.size).toBeGreaterThan(0);
    expect(fencedCatalog().filter(id => canonical.has(id))).toEqual([]);
  });

  it("declares every trigger the cutover verifies and the recovery removes", () => {
    for (const [table, name] of FENCE_TRIGGERS) {
      expect(ALL_FENCE_SQL).toContain(`trigger ${name}\n`);
      expect(ALL_FENCE_SQL).toContain(`drop trigger if exists ${name} on public.${table};`);
    }
    expect(ALL_FENCE_SQL.match(/^create (constraint )?trigger /gm)).toHaveLength(FENCE_TRIGGERS.length);
  });

  it("keeps receipt-checked triggers deferred so atomic RPCs can write their receipt last", () => {
    expect(FENCE_SQL.match(/deferrable initially deferred/g)).toHaveLength(7);
    expect(FENCE_SQL).not.toMatch(/set constraints/i);
  });

  it("builds one transaction that locks every fenced table before any migration statement", () => {
    const sources = readCutoverSources(ROOT);
    expect(sources.map(s => s.version)).toEqual(CUTOVER_MIGRATIONS.map(([v]) => v));
    const bundle = buildApplyBundle(sources);
    const lines = bundle.split("\n");
    expect(lines[1]).toBe("begin;");
    expect(bundle.trimEnd().endsWith("commit;")).toBe(true);
    expect(bundle.match(/^begin;$/gm)).toHaveLength(1);
    expect(bundle.match(/^commit;$/gm)).toHaveLength(1);
    const lock = bundle.indexOf(`lock table ${FENCED_TABLES.join(", ")} in share row exclusive mode;`);
    expect(lock).toBeGreaterThan(bundle.indexOf("set local lock_timeout = '3s';"));
    let previous = lock;
    for (const source of sources) {
      const at = bundle.indexOf(`-- >>> ${source.file}`);
      expect(at).toBeGreaterThan(previous);
      previous = at;
    }
    expect(bundle.indexOf("CUTOVER_LEDGER_NOT_EMPTY")).toBeLessThan(bundle.indexOf(`-- >>> ${sources[0].file}`));
    expect(bundle.indexOf("CUTOVER_TRIGGER_MISSING")).toBeGreaterThan(previous);
  });

  it("pause and resume change only the control row and verify the switch before COMMIT", () => {
    const pause = buildPauseBundle("QA incident");
    const resume = buildResumeBundle();
    for (const [bundle, flag] of [[pause, "true"], [resume, "false"]] as const) {
      expect(bundle.match(/^begin;$/gm)).toHaveLength(1);
      expect(bundle.match(/^commit;$/gm)).toHaveLength(1);
      expect(bundle).toContain(`update public.bty_reward_write_control set paused = ${flag},`);
      expect(bundle).not.toMatch(/\b(delete|insert|truncate|drop)\b/i);
      expect(bundle.match(/\bupdate public\.\w+/g)).toEqual(["update public.bty_reward_write_control"]);
    }
    expect(pause).toContain("$bty_reason$QA incident$bty_reason$");
    expect(() => buildPauseBundle("")).toThrow(/reason/);
  });

  it("last-resort fence removal drops only fence triggers and touches no table rows", () => {
    const removal = buildRemoveFenceBundle();
    expect(removal.match(/^drop trigger if exists /gm)).toHaveLength(FENCE_TRIGGERS.length);
    expect(removal).not.toMatch(/\b(delete|update|insert|truncate|drop table|drop function)\b/i);
  });

  it("allows shared XP/Core writes only from the release's atomic writers", () => {
    const allow = SHARED_SQL.slice(SHARED_SQL.indexOf("v_outer = any (array["), SHARED_SQL.indexOf("])) then"));
    const names = [...allow.matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]).sort();
    expect(names).toEqual([
      "bty_apply_arena_run_rewards_v2", "bty_award_activity_xp_v2", "bty_award_lab_xp_v2", "bty_award_run_xp_v2",
      "bty_award_xp_v2", "bty_claim_weekly_reflection_quest", "bty_complete_beginner_reward", "bty_e2e_set_core_xp",
      "bty_event_scan_award", "bty_foundry_award_core_atomic", "bty_foundry_redeem_completion_claim_atomic",
      "bty_record_legacy_choice_reward", "run_season_carryover",
    ]);
    // The previous release's shared writers are never allowed to start a write.
    expect(names).not.toContain("increment_arena_xp");
    expect(names).not.toContain("increment_weekly_xp");
  });
});
