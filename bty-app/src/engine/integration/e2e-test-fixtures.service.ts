/**
 * Deterministic local E2E / admin smoke user: stable UUID, seed/clear helpers.
 * Seeds `arena_profiles`, `weekly_xp` (global pool — canonical “user XP” row), `user_healing_phase`,
 * `user_difficulty_profile`, `user_onboarding_progress`, `user_avatar_state`, and clears `user_equipped_assets`.
 * When service role is available: ensures a minimal `scenarios` row (`locale=en`) for smoke and a non-empty
 * `avatar_composite_snapshots` row for {@link resolveE2ETestUserId}.
 *
 * @see resolveE2ETestUserId — `E2E_FIXTURE_USER_ID` → `SMOKE_TEST_USER_ID` → `LOOP_HEALTH_TEST_USER_ID` → {@link FIXTURE_USER_ID}.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { unlockedAssetsForTier } from "@/engine/avatar/avatar-assets.service";
import type { AvatarTier } from "@/engine/avatar/avatar-state.service";
import {
  getLatestSnapshot,
  persistSnapshotForUser,
} from "@/engine/avatar/avatar-composite-snapshot.service";
import { ensureMinimumScenarioCatalogRows } from "@/engine/scenario/scenario-catalog-sync.service";
import { E2E_SMOKE_SCENARIO_ID } from "@/engine/scenario/scenario-production-exclusions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Minimal `public.scenarios` row for smoke when the DB has no English catalog (composite key locale+id). */
const SMOKE_SCENARIO_ID = E2E_SMOKE_SCENARIO_ID;

/** Stable UUID for local smoke / release / extended health (not a production account). */
export const FIXTURE_USER_ID = "a0000000-0000-4000-8000-00000000e2e1" as const;

/** Default fixture login for {@link seedFixtureUser} / release gate when `E2E_FIXTURE_USER_ID` is unset. */
export const FIXTURE_USER_EMAIL = "e2e-fixture+bty@local.test";
/** Default fixture password (Supabase Auth); align `E2E_PASSWORD` in CI with this when using the default fixture user. */
export const FIXTURE_USER_PASSWORD = "E2eFixture-local-smoke-32chars-min!!";

/** Same keys as `e2e-fixture-user` / smoke env (avoid circular imports). */
const ENV_E2E_FIXTURE_USER_ID = "E2E_FIXTURE_USER_ID" as const;
const ENV_SMOKE_TEST_USER_ID = "SMOKE_TEST_USER_ID" as const;
const ENV_LOOP_HEALTH_TEST_USER_ID = "LOOP_HEALTH_TEST_USER_ID" as const;

const SMOKE_SEED_AVATAR_TIER = 1 as AvatarTier;

/**
 * Same query chain as `full-system-smoke-test` `fetchAnyScenarioId` — keep implementations in sync via this export only.
 */
export async function fetchAnyEnScenarioId(
  admin: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await admin.from("scenarios").select("id").eq("locale", "en");
  if (error || !data?.length) return null;
  const ids = (data as { id?: string }[])
    .map((r) => r.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const nonSmoke = ids.filter((id) => id !== SMOKE_SCENARIO_ID);
  const pool = nonSmoke.length > 0 ? nonSmoke : ids;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

/**
 * Resolves the test user id: `E2E_FIXTURE_USER_ID`, else `SMOKE_TEST_USER_ID`, else `LOOP_HEALTH_TEST_USER_ID`, else {@link FIXTURE_USER_ID}.
 */
export function resolveE2ETestUserId(): string {
  const e2e = process.env[ENV_E2E_FIXTURE_USER_ID]?.trim();
  const a = process.env[ENV_SMOKE_TEST_USER_ID]?.trim();
  const b = process.env[ENV_LOOP_HEALTH_TEST_USER_ID]?.trim();
  return e2e || a || b || FIXTURE_USER_ID;
}

/**
 * E2E cleanup / isolation: resolve Auth user id from email via Admin API (paginated list).
 * Returns null when not found or admin unavailable.
 */
export async function resolveE2EAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const norm = email.trim().toLowerCase();
  for (let page = 1; page <= 40; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`resolveE2EAuthUserIdByEmail listUsers page ${page}: ${error.message}`);
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === norm);
    if (hit?.id) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

function isAuthUserAlreadyExistsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("user already exists") ||
    m.includes("duplicate")
  );
}

/**
 * Ensures at least one `locale = en` scenario exists for {@link fetchAnyEnScenarioId}.
 * Idempotent: no-op when any EN row is present.
 */
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
  if (upErr) throw new Error(`ensureSmokeScenarioRow upsert: ${upErr.message}`);
}

/**
 * Ensures `avatar_composite_snapshots` has non-empty layers for {@link resolveE2ETestUserId} (smoke user).
 */
async function ensureSmokeAvatarSnapshot(admin: SupabaseClient): Promise<void> {
  const userId = resolveE2ETestUserId();
  let snap = await getLatestSnapshot(userId, admin);
  if (snap.layers.length >= 1 && snap.snapped_at) return;

  const persisted = await persistSnapshotForUser(userId, admin);
  if (!persisted) {
    throw new Error("ensureSmokeAvatarSnapshot: persistSnapshotForUser returned null");
  }
  snap = await getLatestSnapshot(userId, admin);
  if (snap.layers.length < 1) {
    throw new Error("ensureSmokeAvatarSnapshot: snapshot layers still empty after persist");
  }
}

function fixtureEmailForUserId(userId: string): string {
  if (userId === FIXTURE_USER_ID) return FIXTURE_USER_EMAIL;
  return `e2e-fixture+${userId}@local.test`;
}

/**
 * Login email that {@link seedFixtureUser} / `ensureFixtureAuthUser` use for {@link resolveE2ETestUserId}.
 * **CI:** `E2E_EMAIL` must match this value or Playwright logs in as the wrong user while the DB is seeded for the fixture id.
 */
export function expectedFixtureLoginEmail(): string {
  return fixtureEmailForUserId(resolveE2ETestUserId());
}

async function ensureFixtureAuthUser(admin: SupabaseClient, userId: string): Promise<void> {
  const { data, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr && !getErr.message.toLowerCase().includes("user not found")) {
    throw new Error(`ensureFixtureAuthUser getUserById: ${getErr.message}`);
  }
  if (data?.user?.id === userId) return;

  const { error } = await admin.auth.admin.createUser({
    id: userId,
    email: fixtureEmailForUserId(userId),
    password: FIXTURE_USER_PASSWORD,
    email_confirm: true,
  });
  if (error && !isAuthUserAlreadyExistsError(error.message)) {
    throw new Error(`ensureFixtureAuthUser createUser: ${error.message}`);
  }
}

/**
 * Upserts core rows for {@link resolveE2ETestUserId} (creates auth user if missing).
 */
export async function seedFixtureUser(): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.warn("[e2e-test-fixtures] seedFixtureUser skipped (no Supabase admin client).");
    return;
  }

  const userId = resolveE2ETestUserId();
  await ensureFixtureAuthUser(admin, userId);
  const now = new Date().toISOString();
  const unlocked = unlockedAssetsForTier(SMOKE_SEED_AVATAR_TIER);

  const { error: apErr } = await admin.from("arena_profiles").upsert(
    {
      user_id: userId,
      lifetime_xp: 0,
      weekly_xp: 0,
      streak: 0,
      league_id: null,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (apErr) throw new Error(`seedFixtureUser arena_profiles: ${apErr.message}`);

  await admin.from("weekly_xp").delete().eq("user_id", userId);
  const { error: wxErr } = await admin.from("weekly_xp").insert({
    user_id: userId,
    league_id: null,
    xp_total: 0,
    updated_at: now,
    created_at: now,
  });
  if (wxErr) throw new Error(`seedFixtureUser weekly_xp: ${wxErr.message}`);

  const { error: hpErr } = await admin.from("user_healing_phase").upsert(
    {
      user_id: userId,
      phase: "ACKNOWLEDGEMENT",
      started_at: now,
      completed_at: null,
    },
    { onConflict: "user_id" },
  );
  if (hpErr) throw new Error(`seedFixtureUser user_healing_phase: ${hpErr.message}`);

  const { error: dfErr } = await admin.from("user_difficulty_profile").upsert(
    {
      user_id: userId,
      difficulty_floor: 1,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (dfErr) throw new Error(`seedFixtureUser user_difficulty_profile: ${dfErr.message}`);

  const { error: obErr } = await admin.from("user_onboarding_progress").upsert(
    {
      user_id: userId,
      step_completed: 5,
      completed_at: now,
    },
    { onConflict: "user_id" },
  );
  if (obErr) throw new Error(`seedFixtureUser user_onboarding_progress: ${obErr.message}`);

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
  if (avErr) throw new Error(`seedFixtureUser user_avatar_state: ${avErr.message}`);

  const { error: eqDelErr } = await admin.from("user_equipped_assets").delete().eq("user_id", userId);
  if (eqDelErr) throw new Error(`seedFixtureUser user_equipped_assets delete: ${eqDelErr.message}`);

  await ensureMinimumScenarioCatalogRows();
  await ensureSmokeScenarioRow(admin);
  await ensureSmokeAvatarSnapshot(admin);
}

/**
 * Removes the resolved fixture auth user (cascades FK children) and clears leftover rows for {@link resolveE2ETestUserId}.
 */
export async function clearFixtureUser(): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.warn("[e2e-test-fixtures] clearFixtureUser skipped (no Supabase admin client).");
    return;
  }

  const userId = resolveE2ETestUserId();

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    const m = delErr.message.toLowerCase();
    if (!m.includes("not found") && !m.includes("user not found")) {
      throw new Error(`clearFixtureUser deleteUser: ${delErr.message}`);
    }
  }

  await admin.from("user_equipped_assets").delete().eq("user_id", userId);
  await admin.from("user_avatar_state").delete().eq("user_id", userId);
  await admin.from("user_onboarding_progress").delete().eq("user_id", userId);
  await admin.from("user_difficulty_profile").delete().eq("user_id", userId);
  await admin.from("user_healing_phase").delete().eq("user_id", userId);
  await admin.from("weekly_xp").delete().eq("user_id", userId);
  await admin.from("arena_profiles").delete().eq("user_id", userId);
}
