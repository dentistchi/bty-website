import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function isResetAllowed(): boolean {
  const env = process.env.BTY_ENV?.trim().toLowerCase();
  return process.env.NODE_ENV !== "production" || env === "staging";
}

type ResetBody = {
  mode?: string;
  clearPendingContracts?: boolean;
  clearNoChangeRisks?: boolean;
};

export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  if (!isResetAllowed()) {
    const out = NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    const out = NextResponse.json({ ok: false, error: "admin_unavailable" }, { status: 503 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  let body: ResetBody = {};
  try {
    body = (await req.json()) as ResetBody;
  } catch {
    body = {};
  }
  const mode = typeof body.mode === "string" ? body.mode.trim() : "full";
  const clearPendingContracts = body.clearPendingContracts === true;
  const clearNoChangeRisks = body.clearNoChangeRisks === true;

  if (mode === "soft_current") {
    const { data: inProgressRows, error: listErr } = await admin
      .from("arena_runs")
      .select("run_id, started_at")
      .eq("user_id", user.id)
      .eq("status", "IN_PROGRESS")
      .order("started_at", { ascending: false })
      .order("run_id", { ascending: false });

    if (listErr) {
      const out = NextResponse.json(
        { ok: false, error: "reset_runs_list_failed", detail: listErr.message },
        { status: 500 },
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }

    const rows = (inProgressRows ?? []) as { run_id: string; started_at?: string }[];
    const keepId = rows.length > 0 ? rows[0]!.run_id : null;
    const abandonIds = rows.slice(1).map((r) => r.run_id).filter(Boolean);

    let abandoned = 0;
    if (abandonIds.length > 0) {
      const { data: abandonedRows, error: abErr } = await admin
        .from("arena_runs")
        .update({ status: "ABANDONED" })
        .eq("user_id", user.id)
        .in("run_id", abandonIds)
        .select("run_id");
      if (abErr) {
        const out = NextResponse.json(
          { ok: false, error: "reset_abandon_runs_failed", detail: abErr.message },
          { status: 500 },
        );
        copyCookiesAndDebug(base, out, req, true);
        return out;
      }
      abandoned = (abandonedRows ?? []).length;
    }

    const { data: removedOrphanPending, error: orphanPendingErr } = await admin
      .from("arena_pending_outcomes")
      .delete()
      .eq("user_id", user.id)
      .eq("choice_type", "no_change_reexposure")
      .eq("status", "pending")
      .is("source_choice_history_id", null)
      .select("id");
    if (orphanPendingErr) {
      const out = NextResponse.json(
        { ok: false, error: "reset_orphan_pending_failed", detail: orphanPendingErr.message },
        { status: 500 },
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }

    let removedContracts: { id: string }[] | null = null;
    if (clearPendingContracts) {
      const { data, error: contractErr } = await admin
        .from("bty_action_contracts")
        .delete()
        .eq("user_id", user.id)
        .eq("status", "pending")
        .select("id");
      if (contractErr) {
        const out = NextResponse.json(
          { ok: false, error: "reset_pending_contracts_failed", detail: contractErr.message },
          { status: 500 },
        );
        copyCookiesAndDebug(base, out, req, true);
        return out;
      }
      removedContracts = data ?? [];
    }

    let removedRisks: { id: string }[] | null = null;
    if (clearNoChangeRisks) {
      const { data, error: risksErr } = await admin
        .from("arena_no_change_risks")
        .delete()
        .eq("user_id", user.id)
        .select("id");
      if (risksErr) {
        const out = NextResponse.json(
          { ok: false, error: "reset_no_change_risks_failed", detail: risksErr.message },
          { status: 500 },
        );
        copyCookiesAndDebug(base, out, req, true);
        return out;
      }
      removedRisks = data ?? [];
    }

    const out = NextResponse.json({
      ok: true,
      userId: user.id,
      mode: "soft_current",
      reset: {
        kept_in_progress_run_id: keepId,
        abandoned_in_progress_runs: abandoned,
        removed_orphan_pending_no_change_reexposure: (removedOrphanPending ?? []).length,
        removed_pending_contracts: removedContracts?.length ?? 0,
        removed_no_change_risks: removedRisks?.length ?? 0,
      },
      client: {
        clear_local_storage: false,
        reason: "staging_arena_state_soft_reset",
      },
    });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  // full: delete all selector history so the next session starts at core_01
  const [
    runsResult,
    scenarioHistoryResult,
    choiceHistoryResult,
    eventsResult,
    contractsResult,
    pendingOutcomesResult,
    risksResult,
  ] = await Promise.all([
    admin.from("arena_runs").delete().eq("user_id", user.id).select("run_id"),
    admin.from("user_scenario_history").delete().eq("user_id", user.id).select("user_id"),
    admin.from("user_scenario_choice_history").delete().eq("user_id", user.id).select("id"),
    admin.from("arena_events").delete().eq("user_id", user.id).select("id"),
    admin.from("bty_action_contracts").delete().eq("user_id", user.id).select("id"),
    admin.from("arena_pending_outcomes").delete().eq("user_id", user.id).select("id"),
    admin.from("arena_no_change_risks").delete().eq("user_id", user.id).select("id"),
  ]);

  const firstErr =
    runsResult.error ??
    scenarioHistoryResult.error ??
    choiceHistoryResult.error ??
    eventsResult.error ??
    contractsResult.error ??
    pendingOutcomesResult.error ??
    risksResult.error;

  if (firstErr) {
    const out = NextResponse.json(
      { ok: false, error: "reset_full_failed", detail: firstErr.message },
      { status: 500 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const out = NextResponse.json({
    ok: true,
    userId: user.id,
    mode: "full",
    reset: {
      deleted_runs: (runsResult.data ?? []).length,
      deleted_scenario_history_rows: (scenarioHistoryResult.data ?? []).length,
      deleted_choice_history_rows: (choiceHistoryResult.data ?? []).length,
      deleted_arena_events: (eventsResult.data ?? []).length,
      deleted_contracts: (contractsResult.data ?? []).length,
      deleted_pending_outcomes: (pendingOutcomesResult.data ?? []).length,
      deleted_no_change_risks: (risksResult.data ?? []).length,
    },
    client: {
      clear_local_storage: true,
      reason: "staging_arena_full_reset",
      next_entry: "core_01_training_system_exposure",
    },
  });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
