import { NextResponse } from "next/server";
import { computeResult } from "@/lib/bty/scenario/engine";
import type { ScenarioSubmitPayload } from "@/lib/bty/scenario/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/bty-arena/submit — 시나리오 제출 결과 계산 (engine only, no DB).
 * Body: ScenarioSubmitPayload. Response (200): computeResult payload. Error: 500 { ok: false, error: string }.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ScenarioSubmitPayload;
    const result = computeResult(body);
    return NextResponse.json(result, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Submit failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
