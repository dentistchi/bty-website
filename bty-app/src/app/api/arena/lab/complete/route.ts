import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { awardLabXP } from "@/engine/xp/lab-xp.service";
import {
  computeLabCoreXp,
  LAB_DAILY_ATTEMPT_LIMIT,
  type DifficultyKey,
} from "@/lib/bty/arena/arenaLabXp";
import { getLabAttemptsUsed, consumeLabAttempt } from "@/lib/bty/arena/labUsage";
import {
  arenaIsoDateOnlyFromUnknown,
  arenaLabDifficultyKeyFromUnknown,
} from "@/domain/arena/scenarios";

/**
 * POST /api/arena/lab/complete
 * Leadership Lab submit success: consume 1 daily attempt, grant Core XP only (no Weekly).
 * Body: { scenarioId?: string, choiceId?: string, difficulty?: "easy"|"mid"|"hard"|"extreme", completedOn?: string }
 * — optional **completedOn** (YYYY-MM-DD) validated by **`arenaIsoDateOnlyFromUnknown`** when the key is present.
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

  const bodyObj = body as { difficulty?: unknown; completedOn?: unknown };
  if ("completedOn" in bodyObj) {
    const parsed = arenaIsoDateOnlyFromUnknown(bodyObj.completedOn);
    if (parsed === null) {
      return NextResponse.json({ error: "completed_on_invalid" }, { status: 400 });
    }
  }

  const difficulty: DifficultyKey = arenaLabDifficultyKeyFromUnknown(
    bodyObj.difficulty,
  );
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

  const usageDate = new Date().toISOString().slice(0, 10);
  const sourceId = `lab:${user.id}:${usageDate}:${consumed.attemptsUsed}`;
  const coreResult = await awardLabXP(user.id, coreXp, { supabase, sourceId });
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
