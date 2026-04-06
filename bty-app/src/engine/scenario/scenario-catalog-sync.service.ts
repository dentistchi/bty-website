/**
 * DB mirror: `bty_elite_scenarios.json` → {@link upsertEliteCatalogToPublicScenarios} → `public.scenarios`.
 * Arena runtime does **not** read `public.scenarios` for payloads (see {@link loadArenaScenarioPayloadFromDb}).
 */

import {
  upsertEliteCatalogToPublicScenarios,
} from "@/lib/bty/arena/eliteScenariosCanonical.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type SyncResult = {
  ok: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: { baseId: string; locale?: string; message: string }[];
};

/**
 * Upsert elite catalog into `public.scenarios` (en+ko rows per scenario). Sole allowed sync source.
 */
export async function syncCatalogToDB(): Promise<SyncResult> {
  const r = await upsertEliteCatalogToPublicScenarios();
  if (!r.ok) {
    return {
      ok: false,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [{ baseId: "(elite)", message: r.error ?? "elite upsert failed" }],
    };
  }
  return {
    ok: true,
    inserted: r.insertedOrUpdated,
    updated: 0,
    skipped: 0,
    errors: [],
  };
}

/** 50 scenarios × 2 locales ≈ 100 rows when synced. */
export const MIN_SCENARIO_CATALOG_ROW_COUNT = 50;

/**
 * When `public.scenarios` is **empty**, runs elite upsert once (DB mirror only).
 */
export async function ensureMinimumScenarioCatalogRows(
  minRows: number = MIN_SCENARIO_CATALOG_ROW_COUNT,
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error(
      "[arena] catalog_unavailable: ensureMinimumScenarioCatalogRows — no Supabase admin",
    );
    return;
  }

  const { count, error } = await admin.from("scenarios").select("*", { count: "exact", head: true });

  if (error) {
    console.error(
      "[scenario-catalog-sync] ensureMinimumScenarioCatalogRows count failed:",
      error.message,
    );
    return;
  }

  const n = count ?? 0;
  if (n >= minRows) return;

  if (n === 0) {
    console.warn(
      "[scenario-catalog-sync] public.scenarios empty — upserting elite mirror from bty_elite_scenarios.json",
    );
    const result = await syncCatalogToDB();
    if (!result.ok) {
      console.error("[scenario-catalog-sync] elite mirror upsert failed:", result.errors);
    }
    return;
  }

  console.error(
    `[arena] scenario_catalog_below_minimum: ${n} rows (min ${minRows}); run syncCatalogToDB or deploy elite migration`,
  );
}
