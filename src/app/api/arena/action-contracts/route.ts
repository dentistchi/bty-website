import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  copyCookiesAndDebug,
  requireUser,
  unauthenticated,
} from "@/lib/supabase/route-client";

const actionContractSchema = z.object({
  scenario_id: z.string().min(1),
  db_scenario_id: z.string().min(1),
  selected_primary: z.string().min(1),
  selected_tradeoff: z.string().min(1),
  selected_action_decision: z.string().min(1),
  path: z.string().min(1),
  action_label: z.string().min(1),
  who: z.string().min(1),
  what: z.string().min(1),
  when: z.string().min(1),
  evidence: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const { user, supabase, base } = await requireUser(request);
  if (!user) return unauthenticated(request, base);

  const body = await request.json().catch(() => null);

  if (body == null) {
    const out = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    copyCookiesAndDebug(base, out, request, true);
    return out;
  }

  const parsed = actionContractSchema.safeParse(body);

  if (!parsed.success) {
    const out = NextResponse.json(
      {
        error: "INVALID_BODY",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
    copyCookiesAndDebug(base, out, request, true);
    return out;
  }

  const payload = parsed.data;

  const { data, error } = await supabase
    .from("bty_action_contracts")
    .insert({
      user_id: user.id,

      action_id: `json-dev:${payload.scenario_id}:${payload.path}:${crypto.randomUUID()}`,
      action_type: "json_dev_action_contract",
      mode: "arena",

      verification_type: "hybrid",
      verification_mode: "hybrid",
      weight: 1,
      reset_eligible: false,
      le_activation_type: "micro_win",

      deadline_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      chosen_at: new Date().toISOString(),

      status: "pending",
      required: true,

      scenario_id: payload.scenario_id,
      arena_scenario_id: payload.scenario_id,
      primary_choice_id: payload.selected_primary,

      source: "json_dev_runtime",
      details: payload,

      contract_description: payload.what,
      who: payload.who,
      what: payload.what,
      step_when: payload.when,
      raw_text: payload.evidence,
    })
    .select("id,status")
    .single();

  if (error || !data) {
    console.error("action_contract_insert_failed", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });

    if (error?.code === "23505") {
      const out = NextResponse.json(
        { error: "Action Contract already exists" },
        { status: 409 },
      );
      copyCookiesAndDebug(base, out, request, true);
      return out;
    }

    const out = NextResponse.json(
      { error: error?.message ?? "failed_to_insert_action_contract" },
      { status: 500 },
    );
    copyCookiesAndDebug(base, out, request, true);
    return out;
  }

  const out = NextResponse.json({
    id: data.id,
    status: data.status,
  });

  copyCookiesAndDebug(base, out, request, true);
  return out;
}