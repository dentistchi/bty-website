import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum";

function computeLevelTier(xpTotal: number) {
  const safe = Math.max(0, Math.floor(xpTotal || 0));
  const level = Math.floor(safe / 100) + 1;

  let tier: Tier = "Bronze";
  if (safe >= 300) tier = "Platinum";
  else if (safe >= 200) tier = "Gold";
  else if (safe >= 100) tier = "Silver";

  const progressPct = safe % 100; // 0~99
  return { level, tier, progressPct };
}

function fallbackCodeName(userId: string) {
  const seed = userId.replace(/-/g, "").slice(-6);
  const n = parseInt(seed, 16);
  const num = Number.isFinite(n) ? (n % 99) + 1 : 7;
  const labels = ["Builder", "Forge", "Nova", "Atlas", "Pulse", "Vertex", "Echo"];
  const label = labels[(num + userId.length) % labels.length];
  return `${label}-${String(num).padStart(2, "0")}`;
}

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data: weeklyRows, error: weeklyErr } = await supabase
    .from("weekly_xp")
    .select("user_id,xp_total")
    .order("xp_total", { ascending: false })
    .limit(50);

  if (weeklyErr) {
    return NextResponse.json(
      { error: "WEEKLY_XP_QUERY_FAILED", detail: weeklyErr.message },
      { status: 500 }
    );
  }

  const rows = (weeklyRows ?? []).filter((r) => !!r.user_id) as { user_id: string; xp_total?: number }[];
  const userIds = rows.map((r) => r.user_id);

  let profileMap = new Map<string, { code_name: string | null; code_hidden: boolean | null }>();
  if (userIds.length > 0) {
    const { data: profiles, error: profErr } = await supabase
      .from("arena_profiles")
      .select("user_id,code_name,code_hidden")
      .in("user_id", userIds);

    if (!profErr && profiles) {
      (profiles as { user_id: string; code_name?: string | null; code_hidden?: boolean | null }[]).forEach(
        (p) => {
          profileMap.set(p.user_id, {
            code_name: p.code_name ?? null,
            code_hidden: p.code_hidden ?? null,
          });
        }
      );
    }
  }

  const leaderboard = rows.map((r, idx) => {
    const userId = r.user_id;
    const xpTotal = Number(r.xp_total ?? 0);
    const prof = profileMap.get(userId);

    const codeHidden = Boolean(prof?.code_hidden);
    const codeName =
      codeHidden ? "Hidden-777" : (prof?.code_name ? prof.code_name : fallbackCodeName(userId));

    const { level, tier, progressPct } = computeLevelTier(xpTotal);

    return {
      rank: idx + 1,
      userId,
      codeName,
      xpTotal,
      level,
      tier,
      progressPct,
      codeHidden,
    };
  });

  return NextResponse.json({ leaderboard, count: leaderboard.length });
}
