import { NextRequest, NextResponse } from "next/server";
import { getNextScenarioForSession } from "@/engine/integration/scenario-type-router";
import { ScenarioSelectionError, type ScenarioLocalePreference } from "@/engine/scenario/scenario-selector.service";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user, base, supabase } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const raw = req.nextUrl.searchParams.get("locale");
  const locale: ScenarioLocalePreference = raw === "ko" ? "ko" : "en";

  try {
    // Pending contract gate
    const { data: pendingContract } = await supabase
      .from("bty_action_contracts")
      .select(
        "id, action_text, deadline_at," +
          "verification_type, created_at",
      )
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gt("deadline_at", new Date().toISOString())
      .order("deadline_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingContract) {
      const row = pendingContract as unknown as {
        id: string;
        action_text: string;
        deadline_at: string;
        verification_type: string;
        created_at: string;
      };
      const res = NextResponse.json(
        {
          error: "action_contract_pending",
          contract: {
            id: row.id,
            action_text: row.action_text,
            deadline_at: row.deadline_at,
            verification_type: row.verification_type,
            created_at: row.created_at,
          },
        },
        { status: 409 },
      );
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    void supabase
      .from("bty_action_contracts")
      .update({ status: "missed" })
      .eq("user_id", user.id)
      .eq("status", "pending")
      .lte("deadline_at", new Date().toISOString());

    const routed = await getNextScenarioForSession(user.id, locale);
    if (routed === null) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "Arena access suspended until Center requirements are met.",
          code: "user_ejected_from_arena" as const,
        },
        { status: 403 },
      );
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }
    const res = NextResponse.json({
      ok: true,
      scenario: routed.scenario,
      scenarioRoute: routed.route,
      delayedOutcomePending: routed.delayedOutcomePending,
      ...(routed.recallPrompt ? { recallPrompt: routed.recallPrompt } : {}),
      ...(routed.route === "mirror" && routed.mirrors ? { mirrors: routed.mirrors } : {}),
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    if (e instanceof ScenarioSelectionError && e.code === "user_ejected_from_arena") {
      const res = NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: 403 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }
    if (e instanceof ScenarioSelectionError && e.code === "no_scenario_available") {
      const res = NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: 404 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }
    const msg = e instanceof Error ? e.message : "selection_failed";
    const res = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
