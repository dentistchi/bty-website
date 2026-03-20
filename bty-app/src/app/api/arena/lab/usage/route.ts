import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getLabAttemptsUsed } from "@/lib/bty/arena/labUsage";
import { LAB_DAILY_ATTEMPT_LIMIT } from "@/lib/bty/arena/arenaLabXp";
import { arenaLabAttemptsRemaining } from "@/domain/rules/arenaLabAttemptsRemaining";

/**
 * GET /api/arena/lab/usage
 * Returns today's Leadership Lab attempt usage for the current user.
 * Use when entering Lab UI to show remaining attempts.
 */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const attemptsUsed = await getLabAttemptsUsed(supabase, user.id);
  const attemptsRemaining = arenaLabAttemptsRemaining(attemptsUsed, LAB_DAILY_ATTEMPT_LIMIT);

  return NextResponse.json({
    limit: LAB_DAILY_ATTEMPT_LIMIT,
    attemptsUsed,
    attemptsRemaining,
  });
}
