import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { insertNotificationForEvent } from "@/engine/integration/notification-router.service";

export const runtime = "nodejs";

const REMINDER_WINDOW_MS = 6 * 60 * 60 * 1000; // T-6h before deadline_at

/**
 * POST /api/cron/action-contract-reminder
 * T-6h reminder: contracts whose deadline_at falls within the next 6h and are
 * still actionable (status pending) get one in-app notification.
 * Idempotent via last_reminder_sent_at (claimed under an `is null` guard before
 * dispatch — at-most-once even with concurrent runs).
 * Secured by CRON_SECRET (Authorization: Bearer or x-cron-secret).
 */
export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-cron-secret")?.trim();
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfiguration (no admin client)" }, { status: 500 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const windowEndIso = new Date(now.getTime() + REMINDER_WINDOW_MS).toISOString();

  const { data: due, error: selErr } = await admin
    .from("bty_action_contracts")
    .select("id, user_id, deadline_at")
    // Only pending contracts are reminded. Submitted contracts await approver action.
    .eq("status", "pending")
    .is("last_reminder_sent_at", null)
    .gt("deadline_at", nowIso)
    .lte("deadline_at", windowEndIso);

  if (selErr) {
    console.error("[action-contract-reminder] select failed", selErr.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  let reminded = 0;
  for (const row of due ?? []) {
    const contractId = String(row.id);
    const userId = row.user_id ? String(row.user_id) : null;
    if (!userId) continue;

    // Claim first: only the run that flips null -> now dispatches (at-most-once).
    const { data: claimed, error: claimErr } = await admin
      .from("bty_action_contracts")
      .update({ last_reminder_sent_at: nowIso })
      .eq("id", contractId)
      .is("last_reminder_sent_at", null)
      .select("id")
      .maybeSingle();

    if (claimErr) {
      console.error("[action-contract-reminder] claim failed", claimErr.message);
      continue;
    }
    if (!claimed) continue; // already claimed by a concurrent run

    await insertNotificationForEvent(userId, "action_contract_reminder", admin);
    reminded += 1;
  }

  return NextResponse.json({ ok: true, reminded });
}
