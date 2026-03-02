import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getCertifiedStatus } from "@/lib/bty/leadership-engine/certified-lri-service";
import type { CertifiedInputs } from "@/domain/leadership-engine/certified";
import { computeAIRSnapshot } from "@/domain/leadership-engine/air";
import type { ActivationRecord } from "@/domain/leadership-engine/air";

/**
 * GET /api/arena/leadership-engine/certified
 * Returns Certified status (Leader only). Inputs from AIR + stubbed MWD/reset/slip when not yet in DB.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const { data: rows } = await supabase
    .from("le_activation_log")
    .select("activation_id, user_id, type, chosen_at, due_at, completed_at")
    .eq("user_id", user.id)
    .order("chosen_at", { ascending: true });

  const activations: ActivationRecord[] = [];
  if (rows?.length) {
    const activationIds = rows.map((r: { activation_id: string }) => r.activation_id);
    const { data: verifications } = await supabase
      .from("le_verification_log")
      .select("activation_id, verified")
      .in("activation_id", activationIds)
      .order("verified_at", { ascending: false });

    const latestVerified = new Map<string, boolean>();
    for (const v of verifications ?? []) {
      const aid = (v as { activation_id: string }).activation_id;
      if (!latestVerified.has(aid))
        latestVerified.set(aid, (v as { verified: boolean }).verified === true);
    }

    for (const r of rows as Record<string, unknown>[]) {
      activations.push({
        activation_id: String(r.activation_id),
        user_id: String(r.user_id),
        type: r.type === "reset" ? "reset" : "micro_win",
        chosen_at: new Date(String(r.chosen_at)),
        due_at: new Date(String(r.due_at)),
        completed_at: r.completed_at != null ? new Date(String(r.completed_at)) : null,
        verified: latestVerified.get(String(r.activation_id)) ?? false,
      });
    }
  }

  const snapshot = computeAIRSnapshot(activations);
  const air14d = snapshot.air_14d.air;
  const noIntegritySlipIn14d = !snapshot.air_14d.integritySlip;

  const getInputs = async (_userId: string): Promise<CertifiedInputs> => ({
    air14d,
    mwd14d: 0,
    resetComplianceMet: false,
    noIntegritySlipIn14d,
  });

  const status = await getCertifiedStatus(user.id, getInputs);
  const res = NextResponse.json({
    current: status.current,
    reasons_met: status.reasons_met,
    reasons_missing: status.reasons_missing,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
