import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export type UserMWDRow = {
  userId: string;
  email: string;
  mwd7d: number;
  mwd14d: number;
  totalActivations: number;
  completedActivations: number;
  completionRate: number;
  lastActivityAt: string | null;
};

export type MWDMetricsResponse = {
  rows: UserMWDRow[];
  computedAt: string;
};

export async function GET(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  try {
    const { data: logs, error: logErr } = await supabase
      .from("le_activation_log")
      .select("user_id, type, chosen_at, completed_at")
      .eq("type", "micro_win")
      .order("chosen_at", { ascending: true });

    if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 });

    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });
    const emailMap = new Map<string, string>(
      (authData.users ?? []).map((u) => [u.id, u.email ?? u.id]),
    );

    type LogRow = { user_id: string; chosen_at: string; completed_at: string | null };
    const byUser = new Map<string, LogRow[]>();
    for (const row of (logs ?? []) as LogRow[]) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(row);
      byUser.set(row.user_id, list);
    }

    const now = Date.now();
    const cutoff7d = now - 7 * 86_400_000;
    const cutoff14d = now - 14 * 86_400_000;

    const rows: UserMWDRow[] = [];
    for (const [userId, userLogs] of byUser.entries()) {
      const total = userLogs.length;
      const completed = userLogs.filter((l) => l.completed_at != null).length;

      // MWD = distinct calendar days with at least one completed micro_win
      const days7d = new Set<string>();
      const days14d = new Set<string>();
      for (const l of userLogs) {
        if (!l.completed_at) continue;
        const ts = Date.parse(l.completed_at);
        const day = new Date(ts).toISOString().slice(0, 10);
        if (ts >= cutoff7d) days7d.add(day);
        if (ts >= cutoff14d) days14d.add(day);
      }

      const lastActivity = userLogs
        .map((l) => l.chosen_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

      rows.push({
        userId,
        email: emailMap.get(userId) ?? userId,
        mwd7d: days7d.size,
        mwd14d: days14d.size,
        totalActivations: total,
        completedActivations: completed,
        completionRate: total === 0 ? 0 : completed / total,
        lastActivityAt: lastActivity,
      });
    }

    rows.sort((a, b) => b.mwd14d - a.mwd14d || b.completionRate - a.completionRate);

    return NextResponse.json({ rows, computedAt: new Date().toISOString() } satisfies MWDMetricsResponse);
  } catch (err: unknown) {
    console.error("[admin/leadership-metrics/mwd] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch MWD data" },
      { status: 500 },
    );
  }
}
