import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = "force-dynamic";

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum";

function computeLevelTier(xpTotal: number) {
  const safe = Math.max(0, Math.floor(xpTotal || 0));
  const level = Math.floor(safe / 100) + 1;

  let tier: Tier = "Bronze";
  if (safe >= 300) tier = "Platinum";
  else if (safe >= 200) tier = "Gold";
  else if (safe >= 100) tier = "Silver";

  const progressPct = safe % 100;
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

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const hasCookie = cookieHeader.length > 0 ? "1" : "0";

  const res = NextResponse.json({ leaderboard: [], count: 0 }, { status: 200 });
  res.headers.set("x-auth-debug-cookie-in", hasCookie);
  res.headers.set("x-auth-debug-cookie-len", String(cookieHeader.length));

  let didSetAll = "0";
  const hostname = req.nextUrl.hostname;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        didSetAll = "1";
        cookies.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, {
            ...(options ?? {}),
            path: "/",
            domain: hostname,
            sameSite: "lax",
            secure: true,
            httpOnly: true,
          });
        });
      },
    },
  });

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  res.headers.set("x-auth-debug-setall", didSetAll);
  res.headers.set("x-auth-debug-user", user ? "1" : "0");

  if (!user) {
    const errRes = NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    res.headers.forEach((v, k) => errRes.headers.set(k, v));
    return errRes;
  }

  const { data: weeklyRows, error: weeklyErr } = await supabase
    .from("weekly_xp")
    .select("user_id,xp_total")
    .order("xp_total", { ascending: false })
    .limit(50);

  if (weeklyErr) {
    const errRes = NextResponse.json(
      { error: "WEEKLY_XP_QUERY_FAILED", detail: weeklyErr.message },
      { status: 500 }
    );
    res.headers.forEach((v, k) => errRes.headers.set(k, v));
    return errRes;
  }

  const rows = (weeklyRows ?? []).filter((r) => !!r.user_id) as { user_id: string; xp_total?: number }[];
  const userIds = rows.map((r) => r.user_id);

  let profileMap = new Map<string, { code_name: string | null; code_hidden: boolean | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("arena_profiles")
      .select("user_id,code_name,code_hidden")
      .in("user_id", userIds);

    (profiles ?? []).forEach((p: { user_id: string; code_name?: string | null; code_hidden?: boolean | null }) => {
      profileMap.set(p.user_id, {
        code_name: p.code_name ?? null,
        code_hidden: p.code_hidden ?? null,
      });
    });
  }

  const leaderboard = rows.map((r, idx) => {
    const userId = r.user_id;
    const xpTotal = Number(r.xp_total ?? 0);
    const prof = profileMap.get(userId);

    const codeHidden = Boolean(prof?.code_hidden);
    const codeName = codeHidden ? "Hidden-777" : (prof?.code_name ? prof.code_name : fallbackCodeName(userId));

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

  const out = NextResponse.json({ leaderboard, count: leaderboard.length }, { status: 200 });
  res.headers.forEach((v, k) => out.headers.set(k, v));
  return out;
}
