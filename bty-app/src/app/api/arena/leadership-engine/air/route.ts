import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { computeAIRSnapshot } from "@/domain/leadership-engine/air";
import type { ActivationRecord } from "@/domain/leadership-engine/air";

/**
 * GET /api/arena/leadership-engine/air
 * Returns AIR for 7d, 14d, 90d from activation + verification logs. UI displays only.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const { data: rows } = await supabase
    .from("le_activation_log")
    .select("activation_id, user_id, type, chosen_at, due_at, completed_at")
    .eq("user_id", user.id)
    .order("chosen_at", { ascending: true });

  if (!rows?.length) {
    const empty = {
      air_7d: { air: 0, missedWindows: 0, integritySlip: false },
      air_14d: { air: 0, missedWindows: 0, integritySlip: false },
      air_90d: { air: 0, missedWindows: 0, integritySlip: false },
    };
    const res = NextResponse.json(empty);
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const activationIds = rows.map((r: { activation_id: string }) => r.activation_id);
  const { data: verifications } = await supabase
    .from("le_verification_log")
    .select("activation_id, verified, verified_at")
    .in("activation_id", activationIds)
    .order("verified_at", { ascending: false });

  const latestVerifiedByActivation = new Map<string, boolean>();
  for (const v of verifications ?? []) {
    const aid = (v as { activation_id: string }).activation_id;
    if (!latestVerifiedByActivation.has(aid)) {
      latestVerifiedByActivation.set(aid, (v as { verified: boolean }).verified === true);
    }
  }

  const activations: ActivationRecord[] = rows.map((r: Record<string, unknown>) => ({
    activation_id: String(r.activation_id),
    user_id: String(r.user_id),
    type: r.type === "reset" ? "reset" : "micro_win",
    chosen_at: new Date(String(r.chosen_at)),
    due_at: new Date(String(r.due_at)),
    completed_at: r.completed_at != null ? new Date(String(r.completed_at)) : null,
    verified: latestVerifiedByActivation.get(String(r.activation_id)) ?? false,
  }));

  const snapshot = computeAIRSnapshot(activations);
  const res = NextResponse.json({
    air_7d: snapshot.air_7d,
    air_14d: snapshot.air_14d,
    air_90d: snapshot.air_90d,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
