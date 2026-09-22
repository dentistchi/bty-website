import type { SupabaseClient } from "@supabase/supabase-js";
import { createOneOnOneConversation } from "./proactiveConversation.server";

/**
 * ONE BOT CONVERSATION PER PERSON — resolve it, or create it exactly once.
 * SERVER ONLY. Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * This is the SAME discipline the announcement path already follows, expressed for a caller that
 * has no announcement recipient row. It does not re-implement the lease: it calls the existing
 * `bty_*_teams_conversation_*` functions, which are the durable coordination, and it preserves
 * their ambiguous-delivery semantics exactly.
 *
 * WHAT "AMBIGUOUS" MEANS, AND WHY IT IS NOT A FAILURE TO RETRY. A `createConversation` whose
 * response is lost may still have created a thread in Teams whose id nobody will ever learn. The
 * lease and its creating-marker are therefore LEFT IN PLACE — so no machinery creates a second
 * thread — and the caller reports the recipient as not-yet-deliverable rather than trying again.
 * Only a proven non-creation releases the claim.
 */

export type ConversationResolution =
  | { ok: true; serviceUrl: string; conversationId: string; created: boolean }
  | { ok: false; reason: "not_installed" | "in_progress" | "unknown" | "failed" };

const one = <T>(data: unknown): T | null =>
  Array.isArray(data) ? ((data[0] as T) ?? null) : ((data as T) ?? null);

/** The confirmed pair for this person, or null when BTY has never opened a thread with them. */
export async function readConversationRef(
  admin: SupabaseClient,
  tenantId: string,
  aadObjectId: string,
): Promise<{ serviceUrl: string; conversationId: string } | null> {
  const { data } = await admin
    .from("bty_teams_conversation_refs")
    .select("service_url, conversation_id")
    .eq("tenant_id", tenantId)
    .eq("aad_object_id", aadObjectId)
    .maybeSingle<{ service_url: string; conversation_id: string }>();
  if (!data?.service_url || !data.conversation_id) return null;
  return { serviceUrl: data.service_url, conversationId: data.conversation_id };
}

/**
 * Get this person's bot conversation, creating it under the per-person lease if there is none.
 *
 * `serviceUrl` is the VERIFIED tenant route — the caller reads it from `bty_teams_tenant_routes`,
 * which only a Bot-Framework-verified activity can write. Nothing here guesses an endpoint.
 */
export async function resolveTeamsConversation(
  admin: SupabaseClient,
  params: { tenantId: string; aadObjectId: string; serviceUrl: string; appId: string; token: string },
): Promise<ConversationResolution> {
  const existing = await readConversationRef(admin, params.tenantId, params.aadObjectId);
  if (existing) return { ok: true, ...existing, created: false };

  const { data: bData, error: bErr } = await admin.rpc("bty_begin_teams_conversation_creation", {
    p_tenant_id: params.tenantId,
    p_aad_object_id: params.aadObjectId,
    p_service_url: params.serviceUrl,
  });
  if (bErr) {
    console.error("[teams-training] conversation claim failed", { code: bErr.code ?? "unknown" });
    return { ok: false, reason: "failed" };
  }
  const conv = one<{ result?: string; claim_token?: string | null; service_url?: string | null; conversation_id?: string | null }>(bData);

  if (conv?.result === "already_exists") {
    const serviceUrl = conv.service_url ?? "";
    const conversationId = conv.conversation_id ?? "";
    if (!serviceUrl || !conversationId) return { ok: false, reason: "failed" };
    return { ok: true, serviceUrl, conversationId, created: false };
  }
  if (conv?.result === "in_progress") return { ok: false, reason: "in_progress" };
  if (conv?.result === "conversation_creation_unknown") return { ok: false, reason: "unknown" };
  if (conv?.result !== "ok" || !conv.claim_token) return { ok: false, reason: "failed" };

  const claimToken = conv.claim_token;
  const releaseClaim = async () => {
    const { error } = await admin.rpc("bty_release_teams_conversation_creation_claim", {
      p_tenant_id: params.tenantId, p_aad_object_id: params.aadObjectId, p_claim_token: claimToken,
    });
    if (error) console.error("[teams-training] conversation claim release failed", { code: error.code ?? "unknown" });
  };

  // The create boundary: durable, and as late as possible.
  const { data: mkData, error: mkErr } = await admin.rpc("bty_mark_teams_conversation_creating", {
    p_tenant_id: params.tenantId, p_aad_object_id: params.aadObjectId, p_claim_token: claimToken,
  });
  if (mkErr) {
    console.error("[teams-training] mark creating failed", { code: mkErr.code ?? "unknown" });
    return { ok: false, reason: "failed" };
  }
  const mk = one<{ result?: string; service_url?: string | null; conversation_id?: string | null }>(mkData);
  if (mk?.result === "already_exists") {
    const serviceUrl = mk.service_url ?? "";
    const conversationId = mk.conversation_id ?? "";
    if (!serviceUrl || !conversationId) return { ok: false, reason: "failed" };
    return { ok: true, serviceUrl, conversationId, created: false };
  }
  if (mk?.result !== "creating") {
    await releaseClaim();
    return { ok: false, reason: "failed" };
  }

  const created = await createOneOnOneConversation({
    token: params.token,
    appId: params.appId,
    serviceUrl: params.serviceUrl,
    tenantId: params.tenantId,
    aadObjectId: params.aadObjectId,
  });
  if (!created.ok) {
    if (created.ambiguous) {
      /*
        A thread may exist whose id nobody will learn. The claim and its creating-marker STAY, so
        nothing creates a second one; this recipient is simply not deliverable on this attempt.
      */
      return { ok: false, reason: "unknown" };
    }
    await releaseClaim();
    /*
      The connector's classifier already distinguishes "the app is not installed for this person"
      from a generic 403, by reading Microsoft's own error code. That is the ONE failure a Host can
      act on — install the app for them — so it is carried through by name instead of being folded
      into a generic error the Host cannot do anything about.
    */
    return { ok: false, reason: created.failure === "not_installed" ? "not_installed" : "failed" };
  }

  const { data: cfData, error: cfErr } = await admin.rpc("bty_confirm_teams_conversation_created", {
    p_tenant_id: params.tenantId, p_aad_object_id: params.aadObjectId, p_claim_token: claimToken,
    p_service_url: params.serviceUrl, p_conversation_id: created.conversationId,
  });
  if (cfErr) {
    console.error("[teams-training] conversation confirm failed", { code: cfErr.code ?? "unknown" });
    return { ok: false, reason: "failed" };
  }
  const cf = one<{ result?: string; service_url?: string | null; conversation_id?: string | null }>(cfData);
  if (cf?.result !== "created" && cf?.result !== "already_exists") return { ok: false, reason: "failed" };
  const serviceUrl = cf.service_url ?? "";
  const conversationId = cf.conversation_id ?? "";
  if (!serviceUrl || !conversationId) return { ok: false, reason: "failed" };
  return { ok: true, serviceUrl, conversationId, created: cf.result === "created" };
}
