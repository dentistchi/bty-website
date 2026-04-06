import { NextResponse } from "next/server";
import { resolveArenaScenarioForAnonymousSubmit } from "@/lib/bty/arena/arenaScenarioResolve.server";
import { computeResultFromScenario } from "@/lib/bty/scenario/engine";
import type { ScenarioSubmitPayload } from "@/lib/bty/scenario/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/bty-arena/submit — choice scoring from DB catalog or pswitch (no legacy SCENARIOS).
 * Mirror ids require authenticated submit path with userId.
 * Body: ScenarioSubmitPayload. Response (200): computeResult payload. 503: catalog / payload missing.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ScenarioSubmitPayload;
    const locale = body.locale === "ko" ? "ko" : "en";
    const scenario = await resolveArenaScenarioForAnonymousSubmit(body.scenarioId, locale);
    if (!scenario) {
      console.error("[arena] scenario_payload_missing bty-arena/submit", {
        scenarioId: body.scenarioId,
        locale,
        legacyFallback: "blocked",
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Scenario not found",
          code: "scenario_payload_missing",
        },
        { status: 503 },
      );
    }
    const result = computeResultFromScenario(scenario, body);
    return NextResponse.json(result, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Submit failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
