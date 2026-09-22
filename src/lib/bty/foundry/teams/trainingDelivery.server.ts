import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReadCard } from "@/domain/teams/trainingCard";
import { graphConfigFromEnv, getGraphAppToken, probeRecipientEligibility } from "@/lib/bty/microsoft/graphDirectory.server";
import { getBotFrameworkToken } from "@/lib/bty/teams/botToken.server";
import { sendProactiveCard } from "@/lib/bty/teams/proactiveConversation.server";
import { readTenantRoute } from "@/lib/bty/teams/tenantRoute.server";
import { resolveTeamsConversation } from "@/lib/bty/teams/resolveTeamsConversation.server";
import { readGuidanceContent } from "@/lib/bty/foundry/events/foundryGuidanceService";

/**
 * SENDING A TRAINING INTO A TEAMS CHAT.
 * SERVER ONLY. Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * ★ THE CLIENT MAY NAME PEOPLE. IT MAY NOT ASSERT ANYTHING ABOUT THEM.
 *
 * A Host picks colleagues in Teams' own People Picker, and the browser sends back ONLY the Entra
 * object ids it returned. Everything that decides anything is derived here: the Host from the
 * session, event ownership from the database, the tenant from configuration, each recipient's
 * eligibility from Microsoft Graph, and the routing from a tenant route only a verified Bot
 * Framework activity can have written. No email, UPN, display name, conversation id, service url
 * or user id is ever accepted from a payload.
 *
 * ★ V1 IS TEXT + QUIZ. A video or PDF training gets a calm "not yet" rather than a half-working
 * delivery — the learner loop this slice proves is the written-guidance one.
 *
 * ★ ALREADY SENT IS REPORTED, NOT RE-SENT. The unique (event, tenant, recipient) makes a second
 * press idempotent, and the Host is told so rather than the employee being messaged twice.
 */

export type RecipientOutcome =
  | { aadObjectId: string; status: "sent"; displayName: string | null }
  | { aadObjectId: string; status: "already_sent"; displayName: string | null }
  | {
      aadObjectId: string;
      status: "undeliverable";
      displayName: string | null;
      /** A product reason, never a Microsoft error string. */
      reason: "not_eligible" | "not_installed" | "no_route" | "unknown" | "failed";
    };

export type SendTrainingResult =
  | { ok: true; outcomes: RecipientOutcome[] }
  | { ok: false; reason: "not_owner" | "event_not_found" | "unsupported_material" | "no_quiz" | "graph_unavailable" | "tenant_not_configured" | "bot_unavailable" };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The one tenant BTY serves. Configuration, never a payload. */
function configuredTenant(): string | null {
  const t = (process.env.TEAMS_BOT_TENANT_ID ?? "").trim().toLowerCase();
  return GUID.test(t) ? t : null;
}

/**
 * Send one training to the chosen recipients.
 *
 * `ownerUserId` is the SERVER-DERIVED Host. `aadObjectIds` is the only thing the client supplies,
 * and every id in it is validated against Graph before anything is created or sent.
 */
export async function sendTrainingToTeams(
  admin: SupabaseClient,
  input: { ownerUserId: string; eventId: string; aadObjectIds: string[] },
): Promise<SendTrainingResult> {
  const tenantId = configuredTenant();
  if (!tenantId) return { ok: false, reason: "tenant_not_configured" };

  // ---- The Host must own this training. Ownership is read, never claimed. ----
  const { data: event } = await admin
    .from("foundry_events")
    .select("id, owner_user_id, title, status, content_type")
    .eq("id", input.eventId)
    .eq("owner_user_id", input.ownerUserId)
    .maybeSingle<{ id: string; owner_user_id: string; title: string; status: string; content_type: string | null }>();
  if (!event) return { ok: false, reason: "not_owner" };
  if (event.content_type !== "written_guidance") return { ok: false, reason: "unsupported_material" };

  const content = await readGuidanceContent(admin, event.id);
  if (!content) return { ok: false, reason: "event_not_found" };

  const { data: quiz } = await admin
    .from("foundry_event_quizzes")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle<{ event_id: string }>();
  if (!quiz) return { ok: false, reason: "no_quiz" };

  // ---- Routing: only what a verified activity taught us. No endpoint is guessed. ----
  const serviceUrl = await readTenantRoute(admin, tenantId);
  if (!serviceUrl) return { ok: false, reason: "tenant_not_configured" };

  // ---- Graph, for recipient eligibility. Unconfigured or unreachable = we do not know. ----
  const graphConfig = graphConfigFromEnv();
  if (!graphConfig) return { ok: false, reason: "graph_unavailable" };
  if (graphConfig.tenantId !== tenantId) return { ok: false, reason: "tenant_not_configured" };
  const graphToken = await getGraphAppToken(graphConfig);
  if (!graphToken) return { ok: false, reason: "graph_unavailable" };

  const appId = (process.env.TEAMS_BOT_APP_ID ?? "").trim();
  const botToken = await getBotFrameworkToken({ appId });
  if (!botToken.ok) return { ok: false, reason: "bot_unavailable" };

  const outcomes: RecipientOutcome[] = [];
  // Distinct, well-formed ids only. A malformed one is refused rather than sent to Graph.
  const recipients = [...new Set(input.aadObjectIds.map((v) => String(v ?? "").trim().toLowerCase()))].filter((v) =>
    GUID.test(v),
  );

  for (const aadObjectId of recipients) {
    /*
      ELIGIBILITY FIRST, BEFORE ANY ROW OR MESSAGE. Same tenant (the app-only token is issued for
      one tenant, and the configured tenant was compared above), user exists, accountEnabled, and
      userType Member. A guest or a disabled account is not sent an internal training.
    */
    const eligibility = await probeRecipientEligibility(graphToken, aadObjectId);
    if (!eligibility.ok) {
      outcomes.push({ aadObjectId, status: "undeliverable", displayName: null, reason: eligibility.reason === "not_found" ? "not_eligible" : "unknown" });
      continue;
    }
    if (!eligibility.eligible) {
      outcomes.push({ aadObjectId, status: "undeliverable", displayName: null, reason: "not_eligible" });
      continue;
    }
    const displayName = eligibility.displayName;

    // ---- Already delivered? Report it; never message the same person twice for one training. ----
    const { data: existing } = await admin
      .from("foundry_teams_training_deliveries")
      .select("id, delivery_status")
      .eq("event_id", event.id)
      .eq("tenant_id", tenantId)
      .eq("aad_object_id", aadObjectId)
      .maybeSingle<{ id: string; delivery_status: string }>();
    if (existing?.delivery_status === "DELIVERED") {
      outcomes.push({ aadObjectId, status: "already_sent", displayName });
      continue;
    }

    // ---- The conversation. Reused when BTY already has one; created once under the lease. ----
    const conversation = await resolveTeamsConversation(admin, {
      tenantId,
      aadObjectId,
      serviceUrl,
      appId,
      token: botToken.token,
    });
    if (!conversation.ok) {
      outcomes.push({
        aadObjectId,
        status: "undeliverable",
        displayName,
        reason:
          conversation.reason === "not_installed"
            ? "not_installed"
            : conversation.reason === "unknown" || conversation.reason === "in_progress"
              ? "unknown"
              : "failed",
      });
      continue;
    }

    /*
      THE DELIVERY ROW IS WRITTEN BEFORE THE SEND, as PENDING. Its random id is what the card
      carries, so it has to exist before a card can name it — and a row that says PENDING is
      truthful about a send that has not been confirmed. Only an accepted HTTP response promotes it.
    */
    const now = new Date().toISOString();
    const { data: delivery } = await admin
      .from("foundry_teams_training_deliveries")
      .upsert(
        {
          ...(existing ? { id: existing.id } : {}),
          event_id: event.id,
          owner_user_id_snapshot: input.ownerUserId,
          tenant_id: tenantId,
          aad_object_id: aadObjectId,
          display_name_snapshot: displayName,
          service_url: conversation.serviceUrl,
          conversation_id: conversation.conversationId,
          delivery_status: "PENDING",
          delivered_at: null,
          updated_at: now,
        },
        { onConflict: "event_id,tenant_id,aad_object_id" },
      )
      .select("id")
      .maybeSingle<{ id: string }>();
    if (!delivery) {
      outcomes.push({ aadObjectId, status: "undeliverable", displayName, reason: "failed" });
      continue;
    }

    const card = buildReadCard({
      deliveryId: delivery.id,
      title: event.title,
      materialText: content.materialText,
    });
    const sent = await sendProactiveCard({
      token: botToken.token,
      serviceUrl: conversation.serviceUrl,
      conversationId: conversation.conversationId,
      card,
    });
    if (!sent.ok) {
      /*
        AMBIGUOUS IS NOT FAILURE. The POST had already begun, so Teams may have accepted the card
        and only the response was lost. The row stays PENDING — it is neither claimed as delivered
        nor retried automatically — and the Host is told this person could not be confirmed.
      */
      await admin
        .from("foundry_teams_training_deliveries")
        .update({ delivery_status: sent.ambiguous ? "PENDING" : "UNDELIVERABLE", updated_at: new Date().toISOString() })
        .eq("id", delivery.id);
      outcomes.push({
        aadObjectId,
        status: "undeliverable",
        displayName,
        reason: sent.failure === "not_installed" ? "not_installed" : sent.ambiguous ? "unknown" : "failed",
      });
      continue;
    }

    await admin
      .from("foundry_teams_training_deliveries")
      .update({ delivery_status: "DELIVERED", delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", delivery.id);
    outcomes.push({ aadObjectId, status: "sent", displayName });
  }

  return { ok: true, outcomes };
}
