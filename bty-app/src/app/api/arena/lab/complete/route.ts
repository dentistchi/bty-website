import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { applyDirectCoreXp } from "@/lib/bty/arena/applyCoreXp";
import {
  computeLabCoreXp,
  LAB_DAILY_ATTEMPT_LIMIT,
  type DifficultyKey,
} from "@/lib/bty/arena/arenaLabXp";
import { getLabAttemptsUsed, consumeLabAttempt } from "@/lib/bty/arena/labUsage";

const DIFFICULTIES: DifficultyKey[] = ["easy", "mid", "hard", "extreme"];

function parseDifficulty(v: unknown): DifficultyKey {
  if (typeof v === "string" && DIFFICULTIES.includes(v as DifficultyKey)) {
    return v as DifficultyKey;
  }
  return "mid";
}

/**
 * POST /api/arena/lab/complete
 * Leadership Lab submit success: consume 1 daily attempt, grant Core XP only (no Weekly).
 * Body: { scenarioId?: string, choiceId?: string, difficulty?: "easy"|"mid"|"hard"|"extreme" }
 */
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const difficulty = parseDifficulty((body as { difficulty?: unknown })?.difficulty);
  const coreXp = computeLabCoreXp(difficulty);

  const consumed = await consumeLabAttempt(supabase, user.id);
  if ("error" in consumed) {
    const used = await getLabAttemptsUsed(supabase, user.id);
    return NextResponse.json(
      {
        error: consumed.error,
        attemptsUsed: used,
        attemptsRemaining: Math.max(0, LAB_DAILY_ATTEMPT_LIMIT - used),
      },
      { status: 429 }
    );
  }

  const coreResult = await applyDirectCoreXp(supabase, user.id, coreXp);
  if ("error" in coreResult) {
    return NextResponse.json({ error: coreResult.error }, { status: 500 });
  }

  const attemptsRemaining = Math.max(0, LAB_DAILY_ATTEMPT_LIMIT - consumed.attemptsUsed);

  return NextResponse.json({
    ok: true,
    coreXp,
    newCoreTotal: coreResult.newCoreTotal,
    attemptsUsed: consumed.attemptsUsed,
    attemptsRemaining,
  });
}
