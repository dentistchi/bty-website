import { NextResponse } from "next/server";
import { checkRecoveryTrigger } from "@/features/growth/logic/checkRecoveryTrigger";
import {
  rowToArenaSignal,
  rowToReflectionEntry,
  type BtyArenaSignalRow,
  type BtyReflectionEntryRow,
} from "@/lib/bty/identity";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/bty/growth/history — reflection entries + compound `recoveryTriggered` (same rule as My Page strip).
 */
export async function GET() {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data: reflectionRows, error: reflectionsError } = await supabase
    .from("bty_reflection_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (reflectionsError) {
    return NextResponse.json({ error: reflectionsError.message }, { status: 500 });
  }

  const { data: signalRows, error: signalsError } = await supabase
    .from("bty_arena_signals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (signalsError) {
    return NextResponse.json({ error: signalsError.message }, { status: 500 });
  }

  const signals = (signalRows ?? []).map((r) => rowToArenaSignal(r as BtyArenaSignalRow));
  const reflections = (reflectionRows ?? []).map((r) => rowToReflectionEntry(r as BtyReflectionEntryRow));

  const recoveryTriggered = checkRecoveryTrigger(signals, reflections);

  return NextResponse.json({
    reflections,
    recoveryTriggered,
  });
}
