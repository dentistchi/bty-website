import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireConsentedUser, unauthenticated } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ensureFieldActionDraft, loadFieldActionContract } from "@/lib/bty/action-contract/fieldActionProducer.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Field Action producer route (Slice 3.1B-3N-5C.3).
 *
 * POST { assignmentId } → create/return the learner's Field Action draft for a COMPLETED Foundry
 * assignment (ownership via the immutable assignment snapshot; idempotent per learner + progress).
 * GET ?contractId=<id> → load the learner's own `field_action` contract (resubmission prefill).
 * Ownership is ALWAYS the server session — the client never supplies user_id. No arena run created.
 */
export async function POST(req: NextRequest) {
  const { user, base, consentDenied } = await requireConsentedUser(req);
  if (!user) return unauthenticated(req, base);
  if (consentDenied) return consentDenied;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId.trim() : "";
  if (!assignmentId) {
    const out = NextResponse.json({ ok: false, error: "MISSING_ASSIGNMENT" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    const out = NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const result = await ensureFieldActionDraft(admin, { learnerUserId: user.id, assignmentId });
  let out: NextResponse;
  if (result.ok) {
    out = NextResponse.json({ ok: true, contract: result.contract, created: result.created });
  } else if (result.code === "progress_not_found" || result.code === "not_owner") {
    // Do not leak whether the event exists — a learner with no completed progress gets a generic 404.
    out = NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  } else {
    out = NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
  copyCookiesAndDebug(base, out, req, true);
  return out;
}

export async function GET(req: NextRequest) {
  const { user, base, consentDenied } = await requireConsentedUser(req);
  if (!user) return unauthenticated(req, base);
  if (consentDenied) return consentDenied;

  const contractId = req.nextUrl.searchParams.get("contractId")?.trim() ?? "";
  if (!contractId) {
    const out = NextResponse.json({ ok: false, error: "MISSING_CONTRACT" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    const out = NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const result = await loadFieldActionContract(admin, { learnerUserId: user.id, contractId });
  let out: NextResponse;
  if (result.ok) {
    out = NextResponse.json({ ok: true, contract: result.contract });
  } else if (result.code === "not_owner") {
    out = NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  } else {
    out = NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
