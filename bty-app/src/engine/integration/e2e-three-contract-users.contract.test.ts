/**
 * C2 `docs/E2E_TEST_USER_CONTRACT.md` vs C3 `e2e-three-contract-users.service.ts`.
 *
 * Requires service role + Supabase URL (skipped in env without them).
 */
import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BEGINNER_CORE_XP_THRESHOLD } from "@/domain/constants";
import { getLatestSnapshot } from "@/engine/avatar/avatar-composite-snapshot.service";
import {
  E2E_CONTRACT_EMAILS,
  E2E_CONTRACT_USER_IDS,
  getE2EThreeContractSpecs,
  seedThreeContractUsers,
} from "@/engine/integration/e2e-three-contract-users.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const CONTRACT_DOC = "docs/E2E_TEST_USER_CONTRACT.md";

function fmt(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Single-line failure per request: email, table, field, expected, actual */
function contractAssertionFail(
  email: string,
  table: string,
  field: string,
  expected: unknown,
  actual: unknown,
): never {
  throw new Error(
    `[E2E contract | ${CONTRACT_DOC}] email=${email} table=${table} field=${field} expected=${fmt(expected)} actual=${fmt(actual)}`,
  );
}

type ComparableCommon = {
  user_onboarding_progress__step_completed: number;
  arena_profiles__core_xp_total: number;
  arena_profiles__arena_status: string;
  arena_profiles__account_status: string;
  weekly_xp__xp_total: number;
  weekly_xp__league_id: null;
  user_healing_phase__phase: string;
  user_difficulty_profile__difficulty_floor: number;
  user_equipped_assets__count: number;
  bty_action_contracts__count: number;
  avatar_composite_snapshots__layer_count: number;
  user_avatar_state__has_row: boolean;
};

async function loadComparableCommon(admin: SupabaseClient, userId: string, email: string): Promise<ComparableCommon> {
  const { data: ob, error: obE } = await admin
    .from("user_onboarding_progress")
    .select("step_completed")
    .eq("user_id", userId)
    .maybeSingle();
  if (obE) contractAssertionFail(email, "user_onboarding_progress", "query", "no error", obE.message);
  if (ob == null) contractAssertionFail(email, "user_onboarding_progress", "row", "exists", "missing");

  const { data: ap, error: apE } = await admin
    .from("arena_profiles")
    .select("core_xp_total, arena_status, account_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (apE) contractAssertionFail(email, "arena_profiles", "query", "no error", apE.message);
  if (ap == null) contractAssertionFail(email, "arena_profiles", "row", "exists", "missing");

  const { data: wxRows, error: wxE } = await admin
    .from("weekly_xp")
    .select("league_id, xp_total")
    .eq("user_id", userId);
  if (wxE) contractAssertionFail(email, "weekly_xp", "query", "no error", wxE.message);
  const globalRows = (wxRows ?? []).filter((r) => (r as { league_id?: unknown }).league_id == null);
  if (globalRows.length !== 1) {
    contractAssertionFail(
      email,
      "weekly_xp",
      "rows(league_id IS NULL)",
      "exactly 1",
      `count=${globalRows.length} total_rows=${(wxRows ?? []).length}`,
    );
  }
  const wx0 = globalRows[0] as { xp_total?: unknown; league_id?: unknown };
  if (wx0.league_id != null) {
    contractAssertionFail(email, "weekly_xp", "league_id", "null", wx0.league_id);
  }

  const { data: hp, error: hpE } = await admin
    .from("user_healing_phase")
    .select("phase")
    .eq("user_id", userId)
    .maybeSingle();
  if (hpE) contractAssertionFail(email, "user_healing_phase", "query", "no error", hpE.message);
  if (hp == null) contractAssertionFail(email, "user_healing_phase", "row", "exists", "missing");

  const { data: df, error: dfE } = await admin
    .from("user_difficulty_profile")
    .select("difficulty_floor")
    .eq("user_id", userId)
    .maybeSingle();
  if (dfE) contractAssertionFail(email, "user_difficulty_profile", "query", "no error", dfE.message);
  if (df == null) contractAssertionFail(email, "user_difficulty_profile", "row", "exists", "missing");

  const { count: eqCount, error: eqE } = await admin
    .from("user_equipped_assets")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (eqE) contractAssertionFail(email, "user_equipped_assets", "query", "no error", eqE.message);

  const { count: acCount, error: acE } = await admin
    .from("bty_action_contracts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (acE) contractAssertionFail(email, "bty_action_contracts", "query", "no error", acE.message);

  const { data: uas, error: uasE } = await admin.from("user_avatar_state").select("user_id").eq("user_id", userId).maybeSingle();
  if (uasE) contractAssertionFail(email, "user_avatar_state", "query", "no error", uasE.message);

  const snap = await getLatestSnapshot(userId, admin);

  return {
    user_onboarding_progress__step_completed: Number(ob.step_completed),
    arena_profiles__core_xp_total: Number(ap.core_xp_total),
    arena_profiles__arena_status: String(ap.arena_status),
    arena_profiles__account_status: String(ap.account_status),
    weekly_xp__xp_total: Number(wx0.xp_total),
    weekly_xp__league_id: null,
    user_healing_phase__phase: String(hp.phase),
    user_difficulty_profile__difficulty_floor: Number(df.difficulty_floor),
    user_equipped_assets__count: eqCount ?? 0,
    bty_action_contracts__count: acCount ?? 0,
    avatar_composite_snapshots__layer_count: snap.layers.length,
    user_avatar_state__has_row: uas != null,
  };
}

function assertCommonContractValues(email: string, c: ComparableCommon): void {
  if (c.user_onboarding_progress__step_completed !== 5) {
    contractAssertionFail(email, "user_onboarding_progress", "step_completed", 5, c.user_onboarding_progress__step_completed);
  }
  if (c.arena_profiles__core_xp_total < BEGINNER_CORE_XP_THRESHOLD) {
    contractAssertionFail(
      email,
      "arena_profiles",
      "core_xp_total",
      `>=${BEGINNER_CORE_XP_THRESHOLD}`,
      c.arena_profiles__core_xp_total,
    );
  }
  if (c.arena_profiles__arena_status !== "ACTIVE") {
    contractAssertionFail(email, "arena_profiles", "arena_status", "ACTIVE", c.arena_profiles__arena_status);
  }
  if (c.arena_profiles__account_status !== "ACTIVE") {
    contractAssertionFail(email, "arena_profiles", "account_status", "ACTIVE", c.arena_profiles__account_status);
  }
  if (c.weekly_xp__xp_total !== 0) {
    contractAssertionFail(email, "weekly_xp", "xp_total", 0, c.weekly_xp__xp_total);
  }
  if (c.user_healing_phase__phase !== "ACKNOWLEDGEMENT") {
    contractAssertionFail(email, "user_healing_phase", "phase", "ACKNOWLEDGEMENT", c.user_healing_phase__phase);
  }
  if (c.user_difficulty_profile__difficulty_floor !== 1) {
    contractAssertionFail(email, "user_difficulty_profile", "difficulty_floor", 1, c.user_difficulty_profile__difficulty_floor);
  }
  if (!c.user_avatar_state__has_row) {
    contractAssertionFail(email, "user_avatar_state", "row", "exists", "missing");
  }
  if (c.user_equipped_assets__count !== 0) {
    contractAssertionFail(email, "user_equipped_assets", "row_count", 0, c.user_equipped_assets__count);
  }
  if (c.avatar_composite_snapshots__layer_count < 1) {
    contractAssertionFail(
      email,
      "avatar_composite_snapshots",
      "layer_count",
      ">=1",
      c.avatar_composite_snapshots__layer_count,
    );
  }
  if (c.bty_action_contracts__count !== 0) {
    contractAssertionFail(email, "bty_action_contracts", "row_count", 0, c.bty_action_contracts__count);
  }
}

function assertParity(
  emailA: string,
  emailB: string,
  label: string,
  a: ComparableCommon,
  b: ComparableCommon,
): void {
  const keys = Object.keys(a) as (keyof ComparableCommon)[];
  for (const k of keys) {
    if (a[k] !== b[k]) {
      contractAssertionFail(
        `${emailA} vs ${emailB}`,
        label,
        k,
        fmt(b[k]),
        fmt(a[k]),
      );
    }
  }
}

const hasSupabaseAdminEnv = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
    (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()),
);

describe.skipIf(!hasSupabaseAdminEnv)("E2E three contract users — C2 doc vs C3 seed", () => {
  let admin: SupabaseClient;

  beforeAll(async () => {
    admin = getSupabaseAdmin()!;
    await seedThreeContractUsers();
    await seedThreeContractUsers();
  }, 180_000);

  it("auth: three users, contract UUIDs, email_confirmed_at", async () => {
    const specs = getE2EThreeContractSpecs();
    expect(specs).toHaveLength(3);

    for (const spec of specs) {
      const { data, error } = await admin.auth.admin.getUserById(spec.userId);
      if (error) {
        contractAssertionFail(spec.email, "auth.users", "getUserById", "no error", error.message);
      }
      const u = data?.user;
      if (!u) {
        contractAssertionFail(spec.email, "auth.users", "row", "exists", "missing");
      }
      if (u.id !== spec.userId) {
        contractAssertionFail(spec.email, "auth.users", "id", spec.userId, u.id);
      }
      const em = (u.email || "").toLowerCase();
      if (em !== spec.email.toLowerCase()) {
        contractAssertionFail(spec.email, "auth.users", "email", spec.email, u.email);
      }
      const confirmed = u.email_confirmed_at ?? (u as { confirmed_at?: string | null }).confirmed_at;
      if (confirmed == null || confirmed === "") {
        contractAssertionFail(spec.email, "auth.users", "email_confirmed_at|confirmed_at", "non-null", confirmed);
      }
    }

    expect(E2E_CONTRACT_USER_IDS.default).toBe("b0000000-0000-4000-8000-00000000e201");
    expect(E2E_CONTRACT_USER_IDS.step6Policy).toBe("b0000000-0000-4000-8000-00000000e202");
    expect(E2E_CONTRACT_USER_IDS.step6Forced).toBe("b0000000-0000-4000-8000-00000000e203");
    expect(E2E_CONTRACT_EMAILS.default).toBe("e2e_default@test.com");
    expect(E2E_CONTRACT_EMAILS.step6Policy).toBe("e2e_step6_policy@test.com");
    expect(E2E_CONTRACT_EMAILS.step6Forced).toBe("e2e_step6_forced@test.com");
  });

  it("common DB state matches contract §2 / §7 for each user", async () => {
    for (const spec of getE2EThreeContractSpecs()) {
      const c = await loadComparableCommon(admin, spec.userId, spec.email);
      assertCommonContractValues(spec.email, c);
    }
  });

  it("e2e_default has bty_profiles; step6 users do not", async () => {
    const def = getE2EThreeContractSpecs().find((s) => s.key === "default")!;
    const { count: defCount, error: defE } = await admin
      .from("bty_profiles")
      .select("*", { count: "exact", head: true })
      .eq("user_id", def.userId);
    if (defE) contractAssertionFail(def.email, "bty_profiles", "query", "no error", defE.message);
    if ((defCount ?? 0) < 1) {
      contractAssertionFail(def.email, "bty_profiles", "row_count", ">=1", defCount ?? 0);
    }

    for (const spec of getE2EThreeContractSpecs().filter((s) => s.key !== "default")) {
      const { count, error } = await admin
        .from("bty_profiles")
        .select("*", { count: "exact", head: true })
        .eq("user_id", spec.userId);
      if (error) contractAssertionFail(spec.email, "bty_profiles", "query", "no error", error.message);
      if ((count ?? 0) !== 0) {
        contractAssertionFail(spec.email, "bty_profiles", "row_count", 0, count ?? 0);
      }
    }
  });

  it("step6_policy and step6_forced: identical comparable public state (contract §3.2 / §7)", async () => {
    const policy = getE2EThreeContractSpecs().find((s) => s.key === "step6Policy")!;
    const forced = getE2EThreeContractSpecs().find((s) => s.key === "step6Forced")!;
    const a = await loadComparableCommon(admin, policy.userId, policy.email);
    const b = await loadComparableCommon(admin, forced.userId, forced.email);
    assertParity(policy.email, forced.email, "parity(step6_policy vs step6_forced)", a, b);
  });

  it("default user matches step6_policy on comparable common fields (only bty_profiles differs)", async () => {
    const def = getE2EThreeContractSpecs().find((s) => s.key === "default")!;
    const policy = getE2EThreeContractSpecs().find((s) => s.key === "step6Policy")!;
    const a = await loadComparableCommon(admin, def.userId, def.email);
    const b = await loadComparableCommon(admin, policy.userId, policy.email);
    assertParity(def.email, policy.email, "parity(default vs step6_policy)", a, b);
  });

  it("idempotency: no duplicate weekly_xp global rows per user after double seed", async () => {
    for (const spec of getE2EThreeContractSpecs()) {
      const { data, error } = await admin.from("weekly_xp").select("id").eq("user_id", spec.userId).is("league_id", null);
      if (error) contractAssertionFail(spec.email, "weekly_xp", "query", "no error", error.message);
      if ((data?.length ?? 0) !== 1) {
        contractAssertionFail(spec.email, "weekly_xp", "rows(league_id IS NULL)", "count=1", `count=${data?.length ?? 0}`);
      }
    }
  });
});
