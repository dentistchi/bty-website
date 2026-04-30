import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type ContractRow = {
  user_id: string;
  status: string;
  deadline_at: string | null;
  verified_at: string | null;
  chosen_at: string | null;
};

export type UserAirRow = {
  userId: string;
  email: string;
  total: number;       // contracts that left draft (selected)
  completed: number;   // approved / verified
  missed: number;      // missed / expired past deadline
  air: number;         // 0–1
  integritySlips: number; // runs of 3+ consecutive misses
  lastActivity: string | null; // ISO of most recent chosen_at
};

export type LeadershipMetricsResponse = {
  rows: UserAirRow[];
  computedAt: string;
};

/** Statuses that count as "user selected this action" (left draft). */
const SELECTED_STATUSES = new Set([
  "pending", "committed", "submitted", "escalated",
  "approved", "completed", "missed", "DONE",
]);

/** Statuses that count as completed. */
const COMPLETED_STATUSES = new Set(["approved", "completed", "DONE"]);

/** Statuses that count as missed. */
const MISSED_STATUSES = new Set(["missed"]);

function computeIntegritySlips(statuses: string[]): number {
  let slips = 0;
  let run = 0;
  let slipOpen = false;
  for (const s of statuses) {
    if (MISSED_STATUSES.has(s)) {
      run++;
      if (run >= 3 && !slipOpen) {
        slips++;
        slipOpen = true;
      }
    } else {
      run = 0;
      slipOpen = false;
    }
  }
  return slips;
}

/**
 * GET /api/admin/leadership-metrics
 * Returns per-user AIR computed from bty_action_contracts.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  try {
    // Fetch all non-draft contracts, ordered by user + time.
    const { data: contracts, error: contractErr } = await supabase
      .from("bty_action_contracts")
      .select("user_id, status, deadline_at, verified_at, chosen_at")
      .not("status", "eq", "draft")
      .order("user_id", { ascending: true })
      .order("chosen_at", { ascending: true });

    if (contractErr) {
      return NextResponse.json({ error: contractErr.message }, { status: 500 });
    }

    // Group by user_id.
    const byUser = new Map<string, ContractRow[]>();
    for (const row of contracts ?? []) {
      const r = row as ContractRow;
      const list = byUser.get(r.user_id) ?? [];
      list.push(r);
      byUser.set(r.user_id, list);
    }

    // Fetch emails from auth.
    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }
    const emailMap = new Map<string, string>(
      (authData.users ?? []).map((u) => [u.id, u.email ?? u.id]),
    );

    // Compute AIR per user.
    const rows: UserAirRow[] = [];
    for (const [userId, userContracts] of byUser.entries()) {
      const selected = userContracts.filter((c) => SELECTED_STATUSES.has(c.status));
      const completed = selected.filter(
        (c) =>
          COMPLETED_STATUSES.has(c.status) ||
          (c.verified_at != null && c.verified_at !== ""),
      );
      const missed = selected.filter((c) => MISSED_STATUSES.has(c.status));

      // Also auto-mark contracts past deadline with no completion as missed.
      const now = Date.now();
      const autoMissed = selected.filter(
        (c) =>
          !COMPLETED_STATUSES.has(c.status) &&
          !MISSED_STATUSES.has(c.status) &&
          c.deadline_at != null &&
          Date.parse(c.deadline_at) < now,
      );

      const totalSelected = selected.length;
      const totalCompleted = completed.length;
      const totalMissed = missed.length + autoMissed.length;

      const air = totalSelected === 0 ? 0 : totalCompleted / totalSelected;

      // Integrity slips: order chronologically by chosen_at.
      const orderedStatuses = selected
        .slice()
        .sort((a, b) => {
          const ta = a.chosen_at ? Date.parse(a.chosen_at) : 0;
          const tb = b.chosen_at ? Date.parse(b.chosen_at) : 0;
          return ta - tb;
        })
        .map((c) => (MISSED_STATUSES.has(c.status) || autoMissed.includes(c) ? "missed" : c.status));

      const integritySlips = computeIntegritySlips(orderedStatuses);

      const lastChosen = selected
        .map((c) => c.chosen_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

      rows.push({
        userId,
        email: emailMap.get(userId) ?? userId,
        total: totalSelected,
        completed: totalCompleted,
        missed: totalMissed,
        air,
        integritySlips,
        lastActivity: lastChosen,
      });
    }

    // Sort by AIR descending.
    rows.sort((a, b) => b.air - a.air || b.completed - a.completed);

    return NextResponse.json({
      rows,
      computedAt: new Date().toISOString(),
    } satisfies LeadershipMetricsResponse);
  } catch (err: unknown) {
    console.error("[admin/leadership-metrics] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch metrics" },
      { status: 500 },
    );
  }
}
