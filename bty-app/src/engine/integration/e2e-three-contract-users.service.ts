/**
 * E2E Test User Contract — three fixed Auth users + DB state per `docs/E2E_TEST_USER_CONTRACT.md`.
 *
 * Rationale: keep {@link seedFixtureUser} unchanged for release gate / legacy `e2e-fixture+*` flows;
 * this module is the single implementation for contract emails and validation.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { unlockedAssetsForTier } from "@/engine/avatar/avatar-assets.service";
import type { AvatarTier } from "@/engine/avatar/avatar-state.service";
import {
  getLatestSnapshot,
  persistSnapshotForUser,
} from "@/engine/avatar/avatar-composite-snapshot.service";
import { ensureMinimumScenarioCatalogRows } from "@/engine/scenario/scenario-catalog-sync.service";
import { E2E_SMOKE_SCENARIO_ID } from "@/engine/scenario/scenario-production-exclusions";
import { BEGINNER_CORE_XP_THRESHOLD } from "@/domain/constants";
import {
  fetchAnyEnScenarioId,
  FIXTURE_USER_PASSWORD,
} from "@/engine/integration/e2e-test-fixtures.service";
import { userHasBlockingArenaActionContract } from "@/lib/bty/arena/blockingArenaActionContract";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const SMOKE_SCENARIO_ID = E2E_SMOKE_SCENARIO_ID;
const SMOKE_SEED_AVATAR_TIER = 1 as AvatarTier;

/** Stable UUIDs (immutable per contract §1). */
export const E2E_CONTRACT_USER_IDS = {
  default: "b0000000-0000-4000-8000-00000000e201",
  step6Policy: "b0000000-0000-4000-8000-00000000e202",
  step6Forced: "b0000000-0000-4000-8000-00000000e203",
} as const;

export type E2EThreeContractKey = keyof typeof E2E_CONTRACT_USER_IDS;

export const E2E_CONTRACT_EMAILS: Record<E2EThreeContractKey, string> = {
  default: "e2e_default@test.com",
  step6Policy: "e2e_step6_policy@test.com",
  step6Forced: "e2e_step6_forced@test.com",
};

export type E2EThreeContractSpec = {
  key: E2EThreeContractKey;
  userId: string;
  email: string;
  /** Env: E2E_PASSWORD, E2E_STEP6_POLICY_PASSWORD, E2E_STEP6_FORCED_PASSWORD — see contract §1. */
  password: string;
  seedBtyProfiles: boolean;
};

function isAuthUserAlreadyExistsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("user already exists") ||
    m.includes("duplicate")
  );
}

function passwordForKey(key: E2EThreeContractKey): string {
  const d = process.env.E2E_PASSWORD?.trim();
  const p = process.env.E2E_STEP6_POLICY_PASSWORD?.trim();
  const f = process.env.E2E_STEP6_FORCED_PASSWORD?.trim();
  if (key === "default") return d || FIXTURE_USER_PASSWORD;
  if (key === "step6Policy") return p || d || FIXTURE_USER_PASSWORD;
  return f || d || FIXTURE_USER_PASSWORD;
}

export function getE2EThreeContractSpecs(): E2EThreeContractSpec[] {
  return (Object.keys(E2E_CONTRACT_USER_IDS) as E2EThreeContractKey[]).map((key) => ({
    key,
    userId: E2E_CONTRACT_USER_IDS[key],
    email: E2E_CONTRACT_EMAILS[key],
    password: passwordForKey(key),
    seedBtyProfiles: key === "default",
  }));
}

async function listUsersFindByEmail(
  admin: SupabaseClient,
  emailNorm: string,
): Promise<User | null> {
  for (let page = 1; page <= 40; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers page ${page}: ${error.message}`);
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === emailNorm);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureSmokeScenarioRow(admin: SupabaseClient): Promise<void> {
  const existingId = await fetchAnyEnScenarioId(admin);
  if (existingId) return;

  const { error: upErr } = await admin.from("scenarios").upsert(
    {
      locale: "en",
      id: SMOKE_SCENARIO_ID,
      title: "E2E smoke minimal",
      body: "Placeholder scenario for automated smoke tests.",
      choices: [{ id: "smoke_continue", text: "Continue", flag_type: "CLEAN" }],
      flag_type: "CLEAN",
      scenario_type: "smoke_synthetic",
      difficulty: 1,
      is_beginner: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "locale,id" },
  );
  if (upErr) throw new Error(`ensureSmokeScenarioRow: ${upErr.message}`);
}

async function deleteAuthUserIfPresent(admin: SupabaseClient, userId: string, label: string): Promise<void> {
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    const m = delErr.message.toLowerCase();
    if (!m.includes("not found") && !m.includes("user not found")) {
      throw new Error(`${label} deleteUser(${userId}): ${delErr.message}`);
    }
  }
}

/**
 * Removes any auth user registered with the same email but a different id (contract §5 step 1).
 */
async function reconcileAuthUserForContract(admin: SupabaseClient, spec: E2EThreeContractSpec): Promise<void> {
  const emailNorm = spec.email.toLowerCase();
  const byEmail = await listUsersFindByEmail(admin, emailNorm);
  if (byEmail?.id && byEmail.id !== spec.userId) {
    console.log(
      `[e2e-three-contract] ${spec.email} remove stale auth user id=${byEmail.id} (expected id=${spec.userId})`,
    );
    await deleteAuthUserIfPresent(admin, byEmail.id, spec.email);
  }

  const { data: canonical, error: getErr } = await admin.auth.admin.getUserById(spec.userId);
  if (getErr && !getErr.message.toLowerCase().includes("user not found")) {
    throw new Error(`${spec.email} getUserById: ${getErr.message}`);
  }

  if (canonical?.user?.id === spec.userId) {
    const u = canonical.user;
    if ((u.email || "").toLowerCase() !== emailNorm) {
      console.log(
        `[e2e-three-contract] ${spec.email} canonical id has wrong email (${u.email}); deleting id=${spec.userId}`,
      );
      await deleteAuthUserIfPresent(admin, spec.userId, spec.email);
    } else {
      const { error: upErr } = await admin.auth.admin.updateUserById(spec.userId, {
        password: spec.password,
        email_confirm: true,
      });
      if (upErr) throw new Error(`${spec.email} updateUserById: ${upErr.message}`);
      console.log(`[e2e-three-contract] ${spec.email} auth OK (existing id=${spec.userId}, password refreshed)`);
      return;
    }
  }

  const { error: createErr } = await admin.auth.admin.createUser({
    id: spec.userId,
    email: spec.email,
    password: spec.password,
    email_confirm: true,
  });
  if (createErr && !isAuthUserAlreadyExistsError(createErr.message)) {
    throw new Error(`${spec.email} createUser: ${createErr.message}`);
  }
  console.log(`[e2e-three-contract] ${spec.email} auth OK (create/ensure id=${spec.userId})`);
}

async function deleteAllBtyActionContracts(admin: SupabaseClient, userId: string, label: string): Promise<void> {
  const { error } = await admin.from("bty_action_contracts").delete().eq("user_id", userId);
  if (error) throw new Error(`${label} bty_action_contracts delete: ${error.message}`);
}

async function seedCommonPublicRows(
  admin: SupabaseClient,
  spec: E2EThreeContractSpec,
  now: string,
): Promise<void> {
  const { userId, email } = spec;
  const unlocked = unlockedAssetsForTier(SMOKE_SEED_AVATAR_TIER);
  const coreXp = BEGINNER_CORE_XP_THRESHOLD;

  await deleteAllBtyActionContracts(admin, userId, email);

  if (!spec.seedBtyProfiles) {
    const { error: bpDelErr } = await admin.from("bty_profiles").delete().eq("user_id", userId);
    if (bpDelErr) throw new Error(`${email} bty_profiles delete: ${bpDelErr.message}`);
  }

  const { error: apErr } = await admin.from("arena_profiles").upsert(
    {
      user_id: userId,
      core_xp_total: coreXp,
      lifetime_xp: 0,
      weekly_xp: 0,
      streak: 0,
      league_id: null,
      arena_status: "ACTIVE",
      account_status: "ACTIVE",
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (apErr) throw new Error(`${email} arena_profiles: ${apErr.message}`);
  console.log(`[e2e-three-contract] ${email} arena_profiles upsert core_xp_total=${coreXp} arena_status=ACTIVE account_status=ACTIVE`);

  await admin.from("weekly_xp").delete().eq("user_id", userId);
  const { error: wxErr } = await admin.from("weekly_xp").insert({
    user_id: userId,
    league_id: null,
    xp_total: 0,
    updated_at: now,
    created_at: now,
  });
  if (wxErr) throw new Error(`${email} weekly_xp: ${wxErr.message}`);

  const { error: hpErr } = await admin.from("user_healing_phase").upsert(
    {
      user_id: userId,
      phase: "ACKNOWLEDGEMENT",
      started_at: now,
      completed_at: null,
    },
    { onConflict: "user_id" },
  );
  if (hpErr) throw new Error(`${email} user_healing_phase: ${hpErr.message}`);

  const { error: dfErr } = await admin.from("user_difficulty_profile").upsert(
    {
      user_id: userId,
      difficulty_floor: 1,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (dfErr) throw new Error(`${email} user_difficulty_profile: ${dfErr.message}`);

  const { error: obErr } = await admin.from("user_onboarding_progress").upsert(
    {
      user_id: userId,
      step_completed: 5,
      completed_at: now,
    },
    { onConflict: "user_id" },
  );
  if (obErr) throw new Error(`${email} user_onboarding_progress: ${obErr.message}`);

  const { error: avErr } = await admin.from("user_avatar_state").upsert(
    {
      user_id: userId,
      current_tier: SMOKE_SEED_AVATAR_TIER,
      unlocked_assets: unlocked,
      equipped_asset_ids: [],
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (avErr) throw new Error(`${email} user_avatar_state: ${avErr.message}`);

  const { error: eqDelErr } = await admin.from("user_equipped_assets").delete().eq("user_id", userId);
  if (eqDelErr) throw new Error(`${email} user_equipped_assets delete: ${eqDelErr.message}`);

  const persisted = await persistSnapshotForUser(userId, admin);
  if (!persisted) throw new Error(`${email} persistSnapshotForUser returned null`);
  const snap = await getLatestSnapshot(userId, admin);
  if (snap.layers.length < 1) {
    throw new Error(`${email} avatar_composite_snapshots empty after persist`);
  }
  console.log(`[e2e-three-contract] ${email} avatar snapshot OK layers=${snap.layers.length}`);
}

/**
 * `bty_profiles` for default journey only — aligned with `scripts/e2e-seed-default-journey-profile.mjs`.
 */
async function seedBtyProfilesDefault(admin: SupabaseClient, userId: string, now: string): Promise<void> {
  const email = E2E_CONTRACT_EMAILS.default;
  const { data: existing, error: selErr } = await admin
    .from("bty_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (selErr && selErr.code !== "PGRST116") {
    throw new Error(`${email} bty_profiles select: ${selErr.message}`);
  }

  const row = {
    user_id: userId,
    current_day: Math.min(28, Math.max(1, Number((existing as { current_day?: number } | null)?.current_day) || 1)),
    season: Math.max(1, Number((existing as { season?: number } | null)?.season) || 1),
    started_at:
      typeof (existing as { started_at?: string } | null)?.started_at === "string"
        ? (existing as { started_at: string }).started_at
        : now,
    updated_at: now,
    last_completed_at:
      (existing as { last_completed_at?: string | null } | null)?.last_completed_at === null ||
      (existing as { last_completed_at?: string | null } | null)?.last_completed_at === undefined
        ? null
        : typeof (existing as { last_completed_at?: string | null })?.last_completed_at === "string"
          ? (existing as { last_completed_at: string }).last_completed_at
          : null,
    bounce_back_count:
      typeof (existing as { bounce_back_count?: number } | null)?.bounce_back_count === "number"
        ? (existing as { bounce_back_count: number }).bounce_back_count
        : 0,
  };

  const { error: upsertError } = await admin.from("bty_profiles").upsert(row, { onConflict: "user_id" });
  if (upsertError) throw new Error(`${email} bty_profiles upsert: ${upsertError.message}`);
  console.log(`[e2e-three-contract] ${email} bty_profiles updated_at=fresh current_day=${row.current_day}`);
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function verifyContractUser(admin: SupabaseClient, spec: E2EThreeContractSpec, seedStartedAtMs: number): Promise<void> {
  const { userId, email, seedBtyProfiles } = spec;

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr) throw new Error(`[verify] ${email} getUserById: ${authErr.message}`);
  assert(Boolean(authUser?.user), `[verify] ${email} missing auth user`);
  assert(
    (authUser!.user!.email || "").toLowerCase() === email.toLowerCase(),
    `[verify] ${email} auth email mismatch got=${authUser!.user!.email}`,
  );
  assert(
    authUser!.user!.email_confirmed_at != null,
    `[verify] ${email} email_confirmed_at is null`,
  );

  const { data: ob, error: obE } = await admin
    .from("user_onboarding_progress")
    .select("step_completed, completed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (obE) throw new Error(`[verify] ${email} user_onboarding_progress: ${obE.message}`);
  assert(ob?.step_completed === 5, `[verify] ${email} step_completed want 5 got=${ob?.step_completed}`);

  const { data: ap, error: apE } = await admin
    .from("arena_profiles")
    .select("core_xp_total, arena_status, account_status, weekly_xp, lifetime_xp, streak, league_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (apE) throw new Error(`[verify] ${email} arena_profiles: ${apE.message}`);
  assert(
    typeof ap?.core_xp_total === "number" && ap.core_xp_total >= BEGINNER_CORE_XP_THRESHOLD,
    `[verify] ${email} core_xp_total need >=${BEGINNER_CORE_XP_THRESHOLD} got=${ap?.core_xp_total}`,
  );
  assert(ap?.arena_status === "ACTIVE", `[verify] ${email} arena_status want ACTIVE got=${ap?.arena_status}`);
  assert(ap?.account_status === "ACTIVE", `[verify] ${email} account_status want ACTIVE got=${ap?.account_status}`);

  const { data: wxRows, error: wxE } = await admin
    .from("weekly_xp")
    .select("league_id, xp_total")
    .eq("user_id", userId)
    .is("league_id", null);
  if (wxE) throw new Error(`[verify] ${email} weekly_xp: ${wxE.message}`);
  assert(
    Array.isArray(wxRows) && wxRows.length >= 1,
    `[verify] ${email} weekly_xp global row (league_id IS NULL) missing`,
  );
  const xpTotal = (wxRows![0] as { xp_total?: number }).xp_total;
  assert(
    typeof xpTotal === "number" && xpTotal >= 0,
    `[verify] ${email} weekly_xp.xp_total invalid got=${xpTotal}`,
  );

  const { data: uas, error: uasE } = await admin
    .from("user_avatar_state")
    .select("user_id, current_tier")
    .eq("user_id", userId)
    .maybeSingle();
  if (uasE) throw new Error(`[verify] ${email} user_avatar_state: ${uasE.message}`);
  assert(uas?.user_id === userId, `[verify] ${email} user_avatar_state row missing`);

  const { data: hp, error: hpE } = await admin
    .from("user_healing_phase")
    .select("phase, completed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (hpE) throw new Error(`[verify] ${email} user_healing_phase: ${hpE.message}`);
  assert(hp?.phase === "ACKNOWLEDGEMENT", `[verify] ${email} phase want ACKNOWLEDGEMENT got=${hp?.phase}`);
  assert(hp?.completed_at == null, `[verify] ${email} healing completed_at must be null`);

  const { data: df, error: dfE } = await admin
    .from("user_difficulty_profile")
    .select("difficulty_floor")
    .eq("user_id", userId)
    .maybeSingle();
  if (dfE) throw new Error(`[verify] ${email} user_difficulty_profile: ${dfE.message}`);
  assert(df?.difficulty_floor === 1, `[verify] ${email} difficulty_floor want 1 got=${df?.difficulty_floor}`);

  const { count: eqCount, error: eqE } = await admin
    .from("user_equipped_assets")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (eqE) throw new Error(`[verify] ${email} user_equipped_assets count: ${eqE.message}`);
  assert((eqCount ?? 0) === 0, `[verify] ${email} user_equipped_assets want 0 rows got=${eqCount}`);

  const snap = await getLatestSnapshot(userId, admin);
  assert(snap.layers.length >= 1, `[verify] ${email} avatar_composite_snapshots layers empty`);

  const blocking = await userHasBlockingArenaActionContract(admin, userId);
  assert(!blocking, `[verify] ${email} blocking bty_action_contracts row present`);

  if (seedBtyProfiles) {
    const { data: bp, error: bpE } = await admin
      .from("bty_profiles")
      .select("updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (bpE) throw new Error(`[verify] ${email} bty_profiles: ${bpE.message}`);
    const updatedAt = bp && typeof bp.updated_at === "string" ? bp.updated_at : null;
    if (updatedAt === null) {
      throw new Error(`[verify] ${email} bty_profiles.updated_at missing`);
    }
    const touch = Date.parse(updatedAt);
    assert(
      !Number.isNaN(touch) && touch >= seedStartedAtMs - 60_000,
      `[verify] ${email} bty_profiles.updated_at not fresh (touch=${updatedAt})`,
    );
  }

  console.log(`[e2e-three-contract] ${email} VERIFY OK`);
}

/**
 * Idempotent seed for the three contract users + post-condition verification.
 *
 * Playwright: `globalSetup` or CI step — `import { seedThreeContractUsers } from "@/engine/integration/e2e-three-contract-users.service"` (tsx resolves `@/`).
 */
export async function seedThreeContractUsers(): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error(
      "seedThreeContractUsers: missing Supabase admin (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  const seedStartedAtMs = Date.now();
  const now = new Date().toISOString();
  const specs = getE2EThreeContractSpecs();

  await ensureMinimumScenarioCatalogRows();
  await ensureSmokeScenarioRow(admin);

  for (const spec of specs) {
    console.log(`[e2e-three-contract] --- ${spec.email} (${spec.key}) ---`);
    await reconcileAuthUserForContract(admin, spec);
    await seedCommonPublicRows(admin, spec, now);
    if (spec.seedBtyProfiles) {
      await seedBtyProfilesDefault(admin, spec.userId, now);
    }
  }

  for (const spec of specs) {
    await verifyContractUser(admin, spec, seedStartedAtMs);
  }

  console.log("[e2e-three-contract] ALL USERS SEEDED + VERIFIED");
}

/** Alias for callers that prefer `setupE2EUsers`. */
export async function setupE2EUsers(): Promise<void> {
  await seedThreeContractUsers();
}
