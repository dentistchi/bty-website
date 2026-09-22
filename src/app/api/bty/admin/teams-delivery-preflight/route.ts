import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { graphConfigFromEnv, getGraphAppToken, probeRecipientEligibility } from "@/lib/bty/microsoft/graphDirectory.server";
import { getBotFrameworkToken } from "@/lib/bty/teams/botToken.server";
import { readTenantRoute } from "@/lib/bty/teams/tenantRoute.server";
import { readConversationRef } from "@/lib/bty/teams/resolveTeamsConversation.server";
import { recordDeliveryAttempt } from "@/lib/bty/foundry/teams/deliveryAttempt.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bty/admin/teams-delivery-preflight — WHICH BOUNDARY FAILS, without messaging anyone.
 * Slice Teams Delivery Diagnostics V1.
 *
 * ★ WHY THIS EXISTS. The measured state was 0 deliveries, 0 sessions and 0 conversation claims,
 * which is exactly what "nobody pressed Send" and "Send failed at the first gate" both look like.
 * Determining which requires running the gates — and the real send path is behind a Host browser
 * session, which an operator diagnosing the system does not have.
 *
 * ★ IT SENDS NOTHING. It runs the two gates that precede the card — Graph eligibility and
 * conversation resolution — and stops. It never creates a conversation (it only READS an existing
 * ref), never writes a delivery row, never posts an activity, and therefore cannot put a card in
 * front of an employee who is not expecting one. A create would take the per-person lease and
 * change real state; a read cannot.
 *
 * ★ IT GRANTS NOTHING. Same default-deny header gate as the existing manager-sync route, and its
 * only writes are diagnostic audit rows. No authority, no delivery, no identity is decided here.
 *
 * ★ IT RETURNS NO MICROSOFT STRINGS. Product stage/result plus a short symbolic code at most.
 */

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(req: NextRequest): boolean {
  const expected = (process.env.MICROSOFT_MANAGER_SYNC_SECRET ?? "").trim();
  if (expected.length < 16) return false;
  return constantTimeEqual(expected, (req.headers.get("x-bty-sync-secret") ?? "").trim());
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
  const aadObjectId = typeof body?.aadObjectId === "string" ? body.aadObjectId.trim().toLowerCase() : "";
  if (!eventId || !GUID.test(aadObjectId)) return NextResponse.json({ error: "bad_input" }, { status: 400 });

  const tenantId = (process.env.TEAMS_BOT_TENANT_ID ?? "").trim().toLowerCase();
  if (!GUID.test(tenantId)) return NextResponse.json({ stage: "config", result: "tenant_not_configured" }, { status: 200 });

  const { data: event } = await admin
    .from("foundry_events")
    .select("id, owner_user_id, content_type")
    .eq("id", eventId)
    .maybeSingle<{ id: string; owner_user_id: string; content_type: string | null }>();
  if (!event) return NextResponse.json({ error: "event_not_found" }, { status: 404 });

  const audit = (stage: "graph_validation" | "conversation_resolution", result: Parameters<typeof recordDeliveryAttempt>[1]["result"], displayName?: string | null, code?: unknown) =>
    recordDeliveryAttempt(admin, {
      eventId: event.id,
      ownerUserId: event.owner_user_id,
      tenantId,
      aadObjectId,
      displayName: displayName ?? null,
      stage,
      result,
      microsoftFailureCode: code,
    });

  // ---- Gate 0: routing. No verified route means nowhere to send that Microsoft would accept. ----
  const serviceUrl = await readTenantRoute(admin, tenantId);

  // ---- Gate 1: Graph eligibility. ----
  const graphConfig = graphConfigFromEnv();
  if (!graphConfig) return NextResponse.json({ stage: "graph_validation", result: "graph_unavailable", hasRoute: Boolean(serviceUrl) });
  const graphToken = await getGraphAppToken(graphConfig);
  if (!graphToken) return NextResponse.json({ stage: "graph_validation", result: "graph_token_failed", hasRoute: Boolean(serviceUrl) });

  const eligibility = await probeRecipientEligibility(graphToken, aadObjectId);
  if (!eligibility.ok) {
    await audit("graph_validation", eligibility.reason === "not_found" ? "not_eligible" : "delivery_unknown", null, eligibility.reason);
    return NextResponse.json({ stage: "graph_validation", result: eligibility.reason, hasRoute: Boolean(serviceUrl) });
  }
  if (!eligibility.eligible) {
    await audit("graph_validation", "not_eligible", null, eligibility.reason);
    return NextResponse.json({ stage: "graph_validation", result: eligibility.reason, hasRoute: Boolean(serviceUrl) });
  }
  await audit("graph_validation", "eligible", eligibility.displayName);

  // ---- Gate 2: conversation. READ ONLY — a create would take the lease and change real state. ----
  const existingRef = await readConversationRef(admin, tenantId, aadObjectId);
  const botToken = await getBotFrameworkToken({ appId: (process.env.TEAMS_BOT_APP_ID ?? "").trim() });

  await audit(
    "conversation_resolution",
    existingRef ? "eligible" : "delivery_unknown",
    eligibility.displayName,
    existingRef ? undefined : "no_existing_ref",
  );

  return NextResponse.json({
    stage: "conversation_resolution",
    result: existingRef ? "reusable_conversation" : "would_need_create",
    hasRoute: Boolean(serviceUrl),
    graphOk: true,
    eligible: true,
    botTokenOk: botToken.ok,
    botTokenReason: botToken.ok ? null : botToken.reason,
    // Presentation only, so the operator knows which person this was about.
    displayName: eligibility.displayName,
  });
}
