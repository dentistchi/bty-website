import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { approveLeaderTrack } from "@/lib/bty/leadership-engine/certified-lri-service";
import { buildLRIInputs } from "@/lib/bty/leadership-engine/lri-inputs.server";
import { buildCertifiedInputs } from "@/lib/bty/leadership-engine/certified-inputs.server";
import { PULSE_MIN, type LRIInputs } from "@/domain/leadership-engine/lri";

export const runtime = "nodejs";

/**
 * POST /api/admin/leadership-engine/approve-leader-track  (admin only)
 *
 * Body: { userId } — candidate to promote.
 * Approver = operating admin (seam-A (a)): the admin∧certified double-gate is
 * inherited from approveLeaderTrack's internal canApproveLeaderTrack check.
 *
 * Contract is fully inherited from approveLeaderTrack (certified-lri-service.ts:67):
 * no new input/return/reason invented. The route only adapts the existing
 * buildLRIInputs union (seam-B pending → not-ready) and maps reasons to HTTP status.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });

  let body: { userId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) return NextResponse.json({ error: "MISSING_USER_ID" }, { status: 400 });

  const approverId = auth.user.id; // seam-A (a): operating admin is the approver

  // seam-B: buildLRIInputs returns { pending } | { inputs }; approveLeaderTrack's
  // GetLRIInputs expects raw LRIInputs. Pending means no pulse data → candidate not
  // ready, so unwrap to a not-ready sentinel (noIntegritySlipIn14d:false forces
  // readiness_flag=false). Existing builder semantics; no new contract.
  const getLRIInputs = async (uid: string): Promise<LRIInputs> => {
    const r = await buildLRIInputs(admin, uid);
    if (r.pending) {
      return {
        air14d: 0,
        mwd14d: 0,
        personalResponsibilityPulse: PULSE_MIN,
        noIntegritySlipIn14d: false,
      };
    }
    return r.inputs;
  };

  const result = await approveLeaderTrack(
    admin,
    userId,
    approverId,
    getLRIInputs,
    (uid: string) => buildCertifiedInputs(admin, uid),
  );

  if (result.approved) return NextResponse.json({ ok: true });

  // reason strings inherited verbatim from approveLeaderTrack; only status mapping here.
  const status =
    result.reason === "candidate_readiness_not_met" ? 409 :
    result.reason === "approver_not_certified" ? 403 :
    500;
  return NextResponse.json({ ok: false, reason: result.reason }, { status });
}
