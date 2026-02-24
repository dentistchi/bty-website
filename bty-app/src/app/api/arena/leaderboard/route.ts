import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { writeSupabaseAuthCookies } from "@/lib/bty/cookies/authCookies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = "force-dynamic";

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
  const hasCookieHeader = cookieHeader.length > 0;
  const cookieNames = req.cookies.getAll().map((c) => c.name);

  const baseHeaders = new Headers();
  baseHeaders.set("Cache-Control", "no-store");
  baseHeaders.set("x-auth-debug-cookie-header", hasCookieHeader ? "1" : "0");
  baseHeaders.set("x-auth-debug-cookie-len", String(cookieHeader.length));
  baseHeaders.set("x-auth-debug-cookie-count", String(cookieNames.length));
  baseHeaders.set("x-auth-debug-cookie-names", cookieNames.slice(0, 10).join(","));

  let didSetAll = false;
  const tmp = NextResponse.json({ ok: true }, { status: 200, headers: baseHeaders });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        didSetAll = true;
        writeSupabaseAuthCookies(tmp, cookies);
      },
    },
  });

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  tmp.headers.set("x-auth-debug-setall", didSetAll ? "1" : "0");
  tmp.headers.set("x-auth-debug-user", user ? "1" : "0");

  if (!user) {
    const body = {
      error: "UNAUTHENTICATED",
      debug: {
        cookieHeader: hasCookieHeader,
        cookieLen: cookieHeader.length,
        cookieCount: cookieNames.length,
        cookieNames: cookieNames.slice(0, 20),
        setAllCalled: didSetAll,
      },
    };
    const out = NextResponse.json(body, { status: 401 });
    tmp.headers.forEach((v, k) => out.headers.set(k, v));
    return out;
  }

  const { data: weeklyRows, error: weeklyErr } = await supabase
    .from("weekly_xp")
    .select("user_id,xp_total")
    .order("xp_total", { ascending: false })
    .limit(50);

  if (weeklyErr) {
    const out = NextResponse.json(
      { error: "WEEKLY_XP_QUERY_FAILED", detail: weeklyErr.message },
      { status: 500 }
    );
    tmp.headers.forEach((v, k) => out.headers.set(k, v));
    return out;
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

    const level = Math.floor(Math.max(0, xpTotal) / 100) + 1;
    const tier =
      xpTotal >= 300 ? "Platinum" : xpTotal >= 200 ? "Gold" : xpTotal >= 100 ? "Silver" : "Bronze";
    const progressPct = Math.max(0, xpTotal) % 100;

    return { rank: idx + 1, userId, codeName, xpTotal, level, tier, progressPct, codeHidden };
  });

  const out = NextResponse.json({ leaderboard, count: leaderboard.length }, { status: 200 });
  tmp.headers.forEach((v, k) => out.headers.set(k, v));
  for (const c of tmp.cookies.getAll()) {
    out.cookies.set(c.name, c.value, {
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
    });
  }
  return out;
}
