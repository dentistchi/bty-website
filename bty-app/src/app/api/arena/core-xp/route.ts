import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

function computeStage(coreXpTotal: number) {
  const rawStage = Math.floor(coreXpTotal / 100) + 1;
  const stage = Math.min(rawStage, 7);
  const stageProgress = coreXpTotal % 100;
  const codeHidden = coreXpTotal >= 700;
  return { stage, stageProgress, codeHidden };
}

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data: row, error } = await supabase
    .from("arena_profiles")
    .select("user_id, core_xp_total, stage, code_name, code_hidden")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!row) {
    const init = computeStage(0);
    const { error: insErr } = await supabase.from("arena_profiles").insert({
      user_id: user.id,
      core_xp_total: 0,
      stage: init.stage,
      code_name: null,
      code_hidden: init.codeHidden,
    });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({
      coreXpTotal: 0,
      stage: init.stage,
      stageProgress: init.stageProgress,
      codeName: null,
      codeHidden: init.codeHidden,
    });
  }

  const coreXpTotal = typeof (row as { core_xp_total?: number }).core_xp_total === "number"
    ? (row as { core_xp_total: number }).core_xp_total
    : 0;
  const calc = computeStage(coreXpTotal);

  return NextResponse.json({
    coreXpTotal,
    stage: calc.stage,
    stageProgress: calc.stageProgress,
    codeName: (row as { code_name?: string | null }).code_name ?? null,
    codeHidden: calc.codeHidden,
  });
}
