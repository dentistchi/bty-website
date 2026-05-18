/**
 * One-off: reseed `public.scenarios` from the canonical elite catalog.
 *
 * Wraps `syncCatalogToDB()` (→ `upsertEliteCatalogToPublicScenarios()`) so the
 * elite mirror can be (re)synced outside the onboarding Step 5 flow — the only
 * other caller. Intended use: run immediately after a migration that empties
 * `public.scenarios` (20260331130000_scenarios_truncate_for_elite_mirror.sql).
 *
 * Run from bty-app/:
 *   npx --yes tsx scripts/sync-elite-catalog.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 * `.env.local` / `.env` are loaded automatically (same loader as
 * scripts/memory-engine-smoke.ts).
 *
 * Safety:
 * - `upsert(..., { onConflict: "locale,id" })` — idempotent; safe to run
 *   repeatedly, including over existing rows.
 * - Data-plane write only (no DDL): the service-role key is sufficient; no
 *   direct DB password / connection string is needed.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenvLocal() {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    const s = readFileSync(p, "utf8");
    for (const line of s.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
    }
  }
}

loadDotenvLocal();

import { syncCatalogToDB } from "../src/engine/scenario/scenario-catalog-sync.service";
import { getSupabaseAdmin } from "../src/lib/supabase-admin";

async function main() {
  try {
    if (!getSupabaseAdmin()) {
      throw new Error(
        "[sync-elite-catalog] missing env: need NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY",
      );
    }

    console.log("[sync-elite-catalog] starting syncCatalogToDB() ...");
    const result = await syncCatalogToDB();
    console.log("[sync-elite-catalog] result:", JSON.stringify(result, null, 2));

    if (!result.ok) {
      console.error("[sync-elite-catalog] FAIL: syncCatalogToDB reported ok=false");
      for (const e of result.errors) {
        console.error(
          `  - ${e.baseId}${e.locale ? ` [${e.locale}]` : ""}: ${e.message}`,
        );
      }
      process.exit(1);
    }

    console.log(
      `[sync-elite-catalog] OK — upserted ${result.inserted} row(s) into public.scenarios`,
    );
  } catch (err) {
    console.error(
      "[sync-elite-catalog] FAIL:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }
}

main();
