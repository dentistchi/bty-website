/**
 * POST /api/arena
 * Optional "combined" endpoint: returns a minimal arena result; when body includes
 * levelId + userText, withArenaReflection appends reflection (summary, questions,
 * next_action, detected). Use when you want one call instead of separate reflect.
 * Requires auth like other arena APIs.
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { withArenaReflection } from "@/lib/bty/arena/withArenaReflection";
import { normalizeOptionalArenaBodyString } from "@/domain/rules/normalizeOptionalArenaBodyString";

export const runtime = "nodejs";

async function baseArenaHandler(req: Request): Promise<Response> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: { levelId?: unknown; scenarioId?: unknown; userText?: string; scenario?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const levelId = normalizeOptionalArenaBodyString(body.levelId);
  const scenarioId = normalizeOptionalArenaBodyString(body.scenarioId);

  return NextResponse.json({
    ok: true,
    levelId: levelId ?? null,
    scenarioId: scenarioId ?? null,
    result: {
      summary: "Scenario completed.",
    },
  });
}

export const POST = withArenaReflection(baseArenaHandler);
