import { NextResponse } from "next/server";
import { parseReflectionWriteBody } from "@/lib/bty/identity";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/bty/growth/reflections — save completed reflection writing.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseReflectionWriteBody(raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    scenario_id: parsed.scenarioId,
    focus: parsed.focus,
    prompt_title: parsed.promptTitle,
    prompt_body: parsed.promptBody,
    cue: parsed.cue,
    answer_1: parsed.answer1,
    answer_2: parsed.answer2,
    answer_3: parsed.answer3,
    commitment: parsed.commitment,
  };
  if (parsed.seedId) insertPayload.seed_id = parsed.seedId;

  const { data, error } = await supabase
    .from("bty_reflection_entries")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    reflectionId: data.id as string,
    id: data.id as string,
  });
}
