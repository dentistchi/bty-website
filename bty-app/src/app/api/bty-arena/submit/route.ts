import { NextResponse } from "next/server";
import { computeResult } from "@/lib/bty/scenario/engine";
import type { ScenarioSubmitPayload } from "@/lib/bty/scenario/types";

// ✅ 안전: 프리렌더 회피
export const dynamic = "force-dynamic";

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
