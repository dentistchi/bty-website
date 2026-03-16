import { NextResponse } from "next/server";
import { getRandomScenario, getScenarioById } from "@/lib/bty/scenario/engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/bty-arena/scenario — 시나리오 조회 (id 있으면 해당, 없으면 랜덤). Query: id?, exclude (csv).
 * Response (200): { ok: true, scenario }. Error: 404 { ok: false, error: "Scenario not found" }.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const exclude = url.searchParams.get("exclude")?.split(",").filter(Boolean) ?? [];

  const scenario = id ? getScenarioById(id) : getRandomScenario(exclude);
  if (!scenario) {
    return NextResponse.json({ ok: false, error: "Scenario not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, scenario });
}
