/**
 * Verify `avatar_composite_snapshots` for the smoke / loop test user.
 * If missing or empty layers, runs {@link persistSnapshotForUser} (engine-derived `layers_json`).
 *
 * Logical seed (tier 0 manifest): characterId = `avatar_base`, no outfit slot, accessoryIds = [].
 *
 * Env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and one of
 * `SMOKE_TEST_USER_ID` | `LOOP_HEALTH_TEST_USER_ID` (loads `.env.local` when present).
 *
 * Usage:
 *   `npx tsx scripts/verify-avatar-composite-snapshot.ts`
 *   `npx tsx scripts/verify-avatar-composite-snapshot.ts --user-id=<uuid>`
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Tier-0 single-layer composite: base only (see OUTFIT_MANIFEST[0]). */
export const SEED_CHARACTER_ID = "avatar_base";
export const SEED_OUTFIT_ID: string | null = null;
export const SEED_ACCESSORY_IDS: string[] = [];

function loadDotEnvLocal(): void {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function userIdFromArgv(): string | undefined {
  const raw = process.argv.find((a) => a.startsWith("--user-id="));
  if (!raw) return undefined;
  const v = raw.slice("--user-id=".length).trim();
  return v || undefined;
}

async function main(): Promise<void> {
  loadDotEnvLocal();
  process.chdir(root);

  const userId =
    userIdFromArgv() ||
    process.env.SMOKE_TEST_USER_ID?.trim() ||
    process.env.LOOP_HEALTH_TEST_USER_ID?.trim();
  if (!userId) {
    console.error(
      "[verify-avatar-composite-snapshot] Pass --user-id=<uuid> or set SMOKE_TEST_USER_ID / LOOP_HEALTH_TEST_USER_ID",
    );
    process.exit(1);
  }

  const { getSupabaseAdmin } = await import("../src/lib/supabase-admin");
  const {
    getLatestSnapshot,
    persistSnapshotForUser,
  } = await import("../src/engine/avatar/avatar-composite-snapshot.service");

  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error(
      "[verify-avatar-composite-snapshot] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  let snap = await getLatestSnapshot(userId, admin);
  const hasLayers = snap.layers.length > 0;

  if (hasLayers && snap.snapped_at) {
    console.log(
      `[verify-avatar-composite-snapshot] OK user=${userId} tier=${snap.tier} layers=${snap.layers.length} snapped_at=${snap.snapped_at}`,
    );
    console.log(
      `[verify-avatar-composite-snapshot] Seed semantics (tier 0 reference): characterId=${SEED_CHARACTER_ID} outfitId=${SEED_OUTFIT_ID} accessoryIds=${JSON.stringify(SEED_ACCESSORY_IDS)}`,
    );
    process.exit(0);
  }

  console.log(
    `[verify-avatar-composite-snapshot] No usable snapshot; persisting (characterId=${SEED_CHARACTER_ID} outfitId=${SEED_OUTFIT_ID} accessoryIds=${JSON.stringify(SEED_ACCESSORY_IDS)})`,
  );
  const persisted = await persistSnapshotForUser(userId, admin);
  if (!persisted) {
    console.error("[verify-avatar-composite-snapshot] persistSnapshotForUser returned null");
    process.exit(1);
  }

  snap = await getLatestSnapshot(userId, admin);
  console.log(
    `[verify-avatar-composite-snapshot] OK user=${userId} tier=${snap.tier} layers=${snap.layers.length} snapped_at=${snap.snapped_at}`,
  );
  if (snap.layers.length < 1) {
    console.error("[verify-avatar-composite-snapshot] layers still empty after persist");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[verify-avatar-composite-snapshot]", e);
  process.exit(1);
});
