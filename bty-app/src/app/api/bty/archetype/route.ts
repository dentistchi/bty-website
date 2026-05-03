/**
 * GET /api/bty/archetype — resolves and returns the determinism-locked archetype for the user.
 *
 * @contract
 * - **200:** `{ ok: true, archetypeName, archetypeClass, source }`
 * - **401:** `{ error: "UNAUTHENTICATED" }`
 * - **500:** `{ error: "INTERNAL_ERROR", detail?: string }`
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { resolveArchetypeForUser, buildFingerprintInput } from "@/lib/bty/archetype";
import { fetchSignalsAndReflections } from "@/lib/bty/identity/fetchIdentityRows";
import { fetchUserPatternSignaturesForMyPage } from "@/lib/bty/arena/fetchUserPatternSignatures.server";
import { btyErrorResponse } from "../errors";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const [signalBundle, sigBundle] = await Promise.all([
      fetchSignalsAndReflections(supabase, user.id),
      fetchUserPatternSignaturesForMyPage(supabase, user.id),
    ]);

    if (!signalBundle.ok) return btyErrorResponse(500, "INTERNAL_ERROR", signalBundle.message);
    if (!sigBundle.ok) return btyErrorResponse(500, "INTERNAL_ERROR", sigBundle.message);

    const { count: scenariosCount } = await supabase
      .from("user_scenario_choice_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { count: contractsCount } = await supabase
      .from("bty_action_contracts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "approved");

    const fingerprintInput = buildFingerprintInput(
      signalBundle.signals,
      sigBundle.rows,
      scenariosCount ?? 0,
      contractsCount ?? 0,
    );

    const result = await resolveArchetypeForUser(supabase, user.id, fingerprintInput);
    if (!result.ok) return btyErrorResponse(500, "INTERNAL_ERROR", result.error);

    // §7.1 PATTERN_FORMING Response Contract — client receives status only, no archetype fields
    if (result.source === "pattern_forming") {
      const res = NextResponse.json({
        ok: true,
        status: "pattern_forming",
        progress: result.progress,
        threshold: result.threshold,
      });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    const res = NextResponse.json({
      ok: true,
      status: "archetype_assigned",
      archetypeName: result.archetypeName,
      archetypeClass: result.archetypeClass,
      source: result.source,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return btyErrorResponse(500, "INTERNAL_ERROR", message);
  }
}
