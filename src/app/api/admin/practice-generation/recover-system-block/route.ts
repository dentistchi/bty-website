import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { recoverPracticeGenerationSystemBlock } from "@/lib/bty/foundry/arena/practiceGenerationRecovery.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/practice-generation/recover-system-block
 * Slice Practice Generation System-Block Recovery V1.
 *
 * Acknowledge that ONE completed system-block attempt was caused by a defect since repaired, so it
 * stops blocking its draft. The attempt itself is never modified.
 *
 * ★ THE ATTEMPT IS NAMED EXPLICITLY, NEVER INFERRED. There is deliberately no "recover the latest
 * block" form: between an operator reading a failure and pressing this, a NEW failure can occur,
 * and a stale intention must not clear a failure nobody has looked at.
 *
 * ★ AUTHORITY IS THE CANONICAL PLATFORM-ADMIN GRANT. `requirePlatformAdmin` resolves an active
 * `bty_platform_admin_grants` row from the session and fails closed; no email, role, Arena
 * membership or Foundry standing is consulted anywhere. The granter id recorded is the one it
 * resolved — the body cannot name a granter.
 *
 * ★ THIS IS THE SUPPORTED OPERATOR ACTION. It exists so recovery never requires direct SQL.
 */
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA40 = /^[0-9a-f]{40}$/;
const SUPPORT_REF = /^[0-9a-f]{12}$/;

/** A refusal the operator can act on maps to its own status; the rest are 409. */
const STATUS: Record<string, number> = {
  source_identity_unavailable: 503,
  recovery_failed: 500,
  blocked_attempt_not_found: 404,
  attempt_draft_mismatch: 404,
  blocked_attempt_source_identity_unavailable: 409,
};

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const draftId = str(body.draftId);
  const blockedAttemptId = str(body.blockedAttemptId);
  const recoveryReasonCode = str(body.recoveryReasonCode);
  const fixedInDeploySha = str(body.fixedInDeploySha).toLowerCase();
  const supportReferenceRaw = str(body.supportReference).toLowerCase();

  if (!GUID.test(draftId)) return NextResponse.json({ error: "invalid_draft_id" }, { status: 400 });
  if (!GUID.test(blockedAttemptId)) return NextResponse.json({ error: "invalid_blocked_attempt_id" }, { status: 400 });
  if (recoveryReasonCode.length < 1 || recoveryReasonCode.length > 80) {
    return NextResponse.json({ error: "invalid_recovery_reason_code" }, { status: 400 });
  }
  if (!SHA40.test(fixedInDeploySha)) return NextResponse.json({ error: "invalid_fixed_deploy_sha" }, { status: 400 });
  if (supportReferenceRaw && !SUPPORT_REF.test(supportReferenceRaw)) {
    return NextResponse.json({ error: "invalid_support_reference" }, { status: 400 });
  }

  const result = await recoverPracticeGenerationSystemBlock(admin, {
    draftId,
    blockedAttemptId,
    grantedByUserId: auth.user.id,
    recoveryReasonCode,
    fixedInDeploySha,
    supportReference: supportReferenceRaw || null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: STATUS[result.reason] ?? 409 });
  }

  /*
    The operator's answer: what was recovered, and what admission says now. No draft content, no
    scenario, no reviewer output — none of it is theirs to read, and none of it is needed to know
    the recovery took.
  */
  return NextResponse.json({
    ok: true,
    recoveryId: result.recoveryId,
    blockedAttemptId: result.blockedAttemptId,
    draftId: result.draftId,
    grantedAt: result.grantedAt,
    alreadyRecovered: result.alreadyRecovered,
    governanceState: result.governanceState,
    canStartGeneration: result.canStartGeneration,
  });
}
