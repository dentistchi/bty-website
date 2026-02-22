import { NextResponse } from "next/server";
import { getRandomScenario, getScenarioById } from "@/lib/bty/scenario/engine";

// ✅ 안전: 프리렌더 회피 (OpenNext/Cloudflare에서도 안정)
export const dynamic = "force-dynamic";

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
