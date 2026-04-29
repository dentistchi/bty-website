import { NextResponse } from "next/server";
import { parseRecoveryBody } from "@/lib/bty/identity";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/bty/growth/recovery — recovery / re-entry commitment record.
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

  const parsed = parseRecoveryBody(raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bty_recovery_entries")
    .insert({
      user_id: user.id,
      source: parsed.source,
      reason: parsed.reason,
      prompt_title: parsed.promptTitle,
      prompt_body: parsed.promptBody,
      cue: parsed.cue,
      pattern_note: parsed.patternNote,
      reset_action: parsed.resetAction,
      reentry_commitment: parsed.reentryCommitment,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    recoveryId: data.id as string,
    id: data.id as string,
  });
}
