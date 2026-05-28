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

/**
 * Best-effort actor device fingerprint (spec §4.1 — self-scan suspicion signal, not a
 * security identifier). Hashes available client-hint headers; null when none present.
 * Full capture (accept-language, IP subnet) is wired at L4 validate; this is the
 * contract-creation-time snapshot only. Uses the global Web Crypto SHA-256 (same idiom
 * as lib/rate-limit.ts and lib/bty/archetype/fingerprint.ts) — no new dependency.
 */
async function computeActorDeviceFingerprintHash(
  request: NextRequest,
): Promise<string | null> {
  const components = [
    request.headers.get("user-agent"),
    request.headers.get("sec-ch-ua"),
    request.headers.get("sec-ch-ua-platform"),
    request.headers.get("sec-ch-ua-mobile"),
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  if (components.length === 0) return null;

  const buf = new TextEncoder().encode(components.join("|"));
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

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

  const actorDeviceFingerprintHash = await computeActorDeviceFingerprintHash(request);

  const { data, error } = await supabase
    .from("bty_action_contracts")
    .insert({
      user_id: user.id,

      action_id: `json-dev:${payload.scenario_id}:${payload.path}:${crypto.randomUUID()}`,
      action_type: "json_dev_action_contract",
      mode: "arena",

      // L2 canonical verification stamp (QR_VERIFICATION_ARCHITECTURE_V1 §6.1, §2.1):
      // new contracts carry the canonical verification_type plus explicit
      // verification_status (Invariant 1) and verification_tier (Invariant 3).
      // actor_device_fingerprint_hash is best-effort (null when no client hints).
      // verification_mode stays 'hybrid' (mode CHECK does not admit the canonical
      // type values; hybrid keeps the CHECK satisfied with no code branch effect).
      verification_type: "action_completed",
      verification_status: "pending",
      verification_tier: "mvp_open",
      actor_device_fingerprint_hash: actorDeviceFingerprintHash,
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
      details: { ...payload, self_report_auto_approve: true },

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