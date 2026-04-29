import { NextResponse } from "next/server";
import { getSupabaseScenarioReader, loadArenaScenarioPayloadFromDb } from "@/lib/bty/arena/scenarioPayloadFromDb";

export const dynamic = "force-dynamic";

/**
 * GET /api/bty-arena/scenario — 시나리오 조회 by id from `public.scenarios` only.
 * Query: `id` (required), `locale` (`ko` | default `en`).
 * Random selection without id is disabled (legacy SCENARIOS removed from runtime).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  const locale = url.searchParams.get("locale") === "ko" ? "ko" : "en";

  if (!id) {
    console.error("[arena] bty-arena/scenario: random mode blocked (legacy_catalog_blocked)");
    return NextResponse.json(
      {
        ok: false,
        error: "id_required",
        code: "legacy_catalog_blocked",
        reason: "Random scenario from static catalog is disabled; pass id.",
      },
      { status: 400 },
    );
  }

  const reader = getSupabaseScenarioReader();
  if (!reader) {
    console.error("[arena] bty-arena/scenario: catalog_unavailable (no Supabase reader)");
    return NextResponse.json(
      { ok: false, error: "catalog_unavailable", code: "catalog_unavailable" },
      { status: 503 },
    );
  }

  const scenario = await loadArenaScenarioPayloadFromDb(reader, id, locale);
  if (!scenario) {
    return NextResponse.json({ ok: false, error: "Scenario not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, scenario });
}
