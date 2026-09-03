import type { SupabaseClient } from "@supabase/supabase-js";
import { buildProactiveMessage } from "@/domain/teams/proactiveMessage";
import { getBotFrameworkToken } from "@/lib/bty/teams/botToken.server";
import {
  createOneOnOneConversation,
  sendProactiveMessage,
  type ConnectorFailure,
} from "@/lib/bty/teams/proactiveConversation.server";
import { resolveDisplayNames } from "@/lib/bty/announcement/recipientDisplayName.server";

/**
 * Tell ONE recipient, in Teams, that a Host asked something of them. Slice A0.2R. SERVER ONLY.
 *
 * ★ AT MOST ONE OUTBOUND SEND, ACROSS OVERLAPPING REQUESTS. `notified_at` alone could not do
 * this: two calls to the notify route both passed `begin`, both POSTed to Teams, and only then
 * did one of them find the other's timestamp. The row now carries a LEASE that one attempt owns,
 * and a durable marker for the moment an outbound send actually began.
 *
 * ★ AN EXPIRED LEASE IS NOT PERMISSION TO RESEND. If the lease died after the send began, the
 * message may already be in that person's Teams and nothing here can know. That resolves to
 * `delivery_unknown`, which is reported and never retried automatically. A false "maybe sent" is
 * visible and repairable; a silent duplicate is neither.
 *
 * ★ TRACK IS AUTHORITATIVE AND THIS IS A SIDE EFFECT. Nothing here writes an announcement, a
 * response, a handled state, a binding or a user. Sending someone a message is not permission to
 * make them an account: `user_id` stays exactly as the canonical Microsoft sign-in flow left it.
 *
 * ORDER, AND WHY EACH STEP SITS WHERE IT DOES:
 *
 *   begin          claim the row, or learn why not                    (locked, atomic)
 *   token          nothing has been risked yet -> safe to release on failure
 *   conversation   reuse, or create                                   -> see the caveat below
 *   mark sending   the LAST instant before delivery becomes possible  (durable)
 *   send           exactly one message
 *   confirm        the lease is spent and notified_at is terminal
 *
 * ★ A SECOND LEASE, SCOPED TO THE PERSON. The delivery lease is per RECIPIENT ROW, so two
 * announcements to the SAME person are two rows that can both observe "no conversation yet" and
 * both create a Teams thread. Measured at two threads and one database row: the UNIQUE key on
 * (tenant, aad) prevents a duplicate ROW and cannot un-create a conversation that already exists
 * inside Teams. A uniqueness constraint is not an idempotency boundary for an external side
 * effect. Conversation creation is therefore serialized on (tenant_id, aad_object_id) by its own
 * claim, and the loser sends nothing and frees its delivery lease for a clean retry.
 *
 * ★ THE ROUTING COORDINATE IS A PAIR. A conversation id means nothing apart from the base URL it
 * was created on, so `service_url` and `conversation_id` are always taken from the same row —
 * the confirmed reference when one exists, the announcement only when creating a new thread.
 */

export type NotifyReason =
  | "not_found"
  | "already_notified"
  | "in_progress"
  | "delivery_unknown"
  | "conversation_in_progress"
  | "conversation_creation_unknown"
  | "no_service_url"
  | "credential_missing"
  | "auth_failed"
  | "unreachable"
  | ConnectorFailure
  | "begin_failed"
  | "claim_lost"
  | "confirm_failed";

export type NotifyResult =
  | { ok: true; conversationId: string; reused: boolean }
  | { ok: false; reason: NotifyReason };

type BeginRow = {
  result?: string;
  claim_token?: string | null;
  tenant_id?: string | null;
  aad_object_id?: string | null;
  service_url?: string | null;
  host_framing?: string | null;
  conversation_id?: string | null;
};

const OPEN_URL = "https://arena.btydaily.com/";
const one = <T,>(d: unknown): T | null => (Array.isArray(d) ? (d[0] as T) ?? null : (d as T) ?? null);

export async function notifyRecipient(
  admin: SupabaseClient,
  params: { recipientId: string; ownerUserId: string; appId?: string },
): Promise<NotifyResult> {
  // ---- 1. CLAIM ----------------------------------------------------------
  const { data, error } = await admin.rpc("bty_begin_recipient_notification", {
    p_recipient_id: params.recipientId,
    p_owner_user_id: params.ownerUserId,
  });
  if (error) {
    console.error("[teams-proactive] begin failed", { code: error.code ?? "unknown" });
    return { ok: false, reason: "begin_failed" };
  }
  const row = one<BeginRow>(data);
  if (row?.result !== "ok") {
    const known = ["not_found", "already_notified", "in_progress", "delivery_unknown", "no_service_url"] as const;
    const r = row?.result ?? "";
    return { ok: false, reason: (known as readonly string[]).includes(r) ? (r as NotifyReason) : "begin_failed" };
  }

  const claimToken = row.claim_token ?? "";
  const tenantId = row.tenant_id ?? "";
  const aadObjectId = row.aad_object_id ?? "";
  const serviceUrl = row.service_url ?? "";
  const hostFraming = row.host_framing ?? "";
  if (!claimToken || !tenantId || !aadObjectId || !serviceUrl || !hostFraming) {
    console.error("[teams-proactive] begin returned an incomplete row");
    return { ok: false, reason: "begin_failed" };
  }

  /*
    Free the lease. ONLY ever called for failures that PROVE nothing was delivered — the function
    also refuses a token that no longer owns the row, so a zombie cannot free a newer owner's claim.
  */
  const release = async (reason: NotifyReason): Promise<NotifyResult> => {
    const { error: relErr } = await admin.rpc("bty_release_recipient_notification_claim", {
      p_recipient_id: params.recipientId,
      p_claim_token: claimToken,
    });
    if (relErr) console.error("[teams-proactive] claim release failed", { code: relErr.code ?? "unknown" });
    return { ok: false, reason };
  };

  // ---- 2. AUTHENTICATE. Nothing has been risked; every failure here is releasable. ----
  const appId = params.appId ?? process.env.TEAMS_BOT_APP_ID ?? "";
  const token = await getBotFrameworkToken({ appId });
  if (!token.ok) return release(token.reason);

  /*
    ---- 3. THE CONVERSATION, SERIALIZED ON THE PERSON ----

    `begin` already returned a confirmed pair if one existed, so reaching the claim means BTY has
    no thread with this person yet — and possibly that another announcement is creating one right
    now. Everything below either yields a canonical pair or sends nothing at all.
  */
  let conversationId = row.conversation_id ?? "";
  let routingUrl = serviceUrl;
  const reused = conversationId !== "";

  if (!reused) {
    const { data: bData, error: bErr } = await admin.rpc("bty_begin_teams_conversation_creation", {
      p_tenant_id: tenantId, p_aad_object_id: aadObjectId, p_service_url: serviceUrl,
    });
    if (bErr) {
      console.error("[teams-proactive] conversation claim failed", { code: bErr.code ?? "unknown" });
      return release("begin_failed");
    }
    const conv = one<{ result?: string; claim_token?: string | null; service_url?: string | null; conversation_id?: string | null }>(bData);
    const convResult = conv?.result;

    if (convResult === "already_exists") {
      // Another attempt finished between `begin` and here. Take BOTH halves from that row.
      routingUrl = conv?.service_url ?? "";
      conversationId = conv?.conversation_id ?? "";
      if (!routingUrl || !conversationId) return release("begin_failed");
    } else if (convResult === "in_progress" || convResult === "conversation_creation_unknown") {
      /*
        Someone else owns this person's thread, or a previous creation's outcome was never
        learned. Either way: NO create, NO send. The DELIVERY lease is released so a retry can
        claim it cleanly the moment the conversation exists — holding it would only make this
        recipient look busy for two minutes for a reason that has nothing to do with them.
      */
      // MAP IT. The conversation RPC says `in_progress` about the PERSON's thread; the caller
      // already has a reason by that name meaning "this recipient row is busy". Letting the
      // conversation's answer surface under that name would point an operator at the wrong row.
      return release(convResult === "in_progress" ? "conversation_in_progress" : "conversation_creation_unknown");
    } else if (convResult !== "ok" || !conv?.claim_token) {
      return release("begin_failed");
    } else {
      const convClaim = conv.claim_token;
      const releaseConv = async () => {
        const { error } = await admin.rpc("bty_release_teams_conversation_creation_claim", {
          p_tenant_id: tenantId, p_aad_object_id: aadObjectId, p_claim_token: convClaim,
        });
        if (error) console.error("[teams-proactive] conversation claim release failed", { code: error.code ?? "unknown" });
      };

      // The create boundary: durable, and as late as possible. A confirmed ref appearing here
      // means someone legitimate finished first, and creating now would make a second thread.
      const { data: mkData, error: mkErr } = await admin.rpc("bty_mark_teams_conversation_creating", {
        p_tenant_id: tenantId, p_aad_object_id: aadObjectId, p_claim_token: convClaim,
      });
      if (mkErr) {
        console.error("[teams-proactive] mark creating failed", { code: mkErr.code ?? "unknown" });
        return release("begin_failed");
      }
      const mk = one<{ result?: string; service_url?: string | null; conversation_id?: string | null }>(mkData);

      if (mk?.result === "already_exists") {
        routingUrl = mk.service_url ?? "";
        conversationId = mk.conversation_id ?? "";
        if (!routingUrl || !conversationId) return release("begin_failed");
      } else if (mk?.result !== "creating") {
        await releaseConv();
        return release("claim_lost");
      } else {
        const created = await createOneOnOneConversation({
          token: token.token, appId, serviceUrl, tenantId, aadObjectId,
        });
        if (!created.ok) {
          if (created.ambiguous) {
            /*
              A thread may exist in Teams whose id nobody will ever learn. The CONVERSATION claim
              and its create marker both stay, so no machinery creates another — only a person
              who has looked. The DELIVERY lease is freed, because the message send never began
              and this recipient is not the thing that is stuck.
            */
            await release("conversation_creation_unknown");
            return { ok: false, reason: "conversation_creation_unknown" };
          }
          await releaseConv();
          return release(created.failure);
        }

        // Record reality and drop the coordination in one transaction.
        const { data: cfData, error: cfErr } = await admin.rpc("bty_confirm_teams_conversation_created", {
          p_tenant_id: tenantId, p_aad_object_id: aadObjectId, p_claim_token: convClaim,
          p_service_url: serviceUrl, p_conversation_id: created.conversationId,
        });
        if (cfErr) {
          console.error("[teams-proactive] conversation confirm failed", { code: cfErr.code ?? "unknown" });
          return release("begin_failed");
        }
        const cf = one<{ result?: string; service_url?: string | null; conversation_id?: string | null }>(cfData);
        // `already_exists` here means a legitimate winner beat us; its pair is canonical and ours
        // is discarded rather than overwriting a confirmed reality.
        if (cf?.result !== "created" && cf?.result !== "already_exists") return release("begin_failed");
        routingUrl = cf.service_url ?? "";
        conversationId = cf.conversation_id ?? "";
        if (!routingUrl || !conversationId) return release("begin_failed");
      }
    }
  }

  // The Host's name, from the provider-written identity — never `user_metadata`, never an email.
  const names = await resolveDisplayNames(admin, [params.ownerUserId]);
  const text = buildProactiveMessage({
    hostName: names.get(params.ownerUserId) ?? null,
    hostFraming,
    openUrl: OPEN_URL,
  });

  /*
    ---- 4. THE SEND BOUNDARY ----
    Durable, and as late as it can possibly be. Everything above provably delivered nothing, so
    marking earlier would strand this person in `delivery_unknown` for failures that never reached
    Teams. Anything other than `sending` means this attempt no longer owns the row — someone
    reclaimed it, or already delivered — and it must NOT send.
  */
  const { data: mData, error: mErr } = await admin.rpc("bty_mark_recipient_notification_sending", {
    p_recipient_id: params.recipientId,
    p_claim_token: claimToken,
  });
  if (mErr) {
    console.error("[teams-proactive] mark sending failed", { code: mErr.code ?? "unknown" });
    return { ok: false, reason: "claim_lost" };
  }
  const mark = one<{ result?: string }>(mData)?.result;
  if (mark !== "sending") {
    return { ok: false, reason: mark === "already_notified" ? "already_notified" : "claim_lost" };
  }

  // ---- 5. SEND ----
  // The PAIR: whichever row supplied the conversation also supplied its base URL.
  const sent = await sendProactiveMessage({ token: token.token, serviceUrl: routingUrl, conversationId, text });
  if (!sent.ok) {
    // AMBIGUOUS: Teams may have accepted it. The lease and the send marker both stay, so this row
    // resolves to `delivery_unknown` and is never resent by machinery — only by a person who has
    // looked. DEFINITIVE: nothing was accepted, so the lease is freed for an immediate retry.
    if (sent.ambiguous) return { ok: false, reason: "delivery_unknown" };
    return release(sent.failure);
  }

  // ---- 6. CONFIRM ----
  const { data: cData, error: cErr } = await admin.rpc("bty_confirm_recipient_notification", {
    p_recipient_id: params.recipientId,
    p_claim_token: claimToken,
  });
  if (cErr) {
    console.error("[teams-proactive] confirm failed after a successful send", { code: cErr.code ?? "unknown" });
    return { ok: false, reason: "confirm_failed" };
  }
  const confirmed = one<{ result?: string }>(cData)?.result;
  if (confirmed !== "notified" && confirmed !== "already_notified") {
    return { ok: false, reason: "confirm_failed" };
  }
  return { ok: true, conversationId, reused };
}
