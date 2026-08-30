/**
 * Teams message action → BTY capture input (PURE). Slice T1.
 *
 * No I/O, no DB, no side effects. This module owns exactly one thing: turning the activity a
 * validated Teams invoke carries into (a) the Microsoft identity tuple BTY resolves on, and
 * (b) the `TeamsCaptureInput` the existing capture domain already speaks.
 *
 * IT AUTHENTICATES NOTHING. Every value here is attacker-controlled until the caller has verified
 * the Bot Framework token; the route verifies first and parses second, never the reverse.
 *
 * WHICH IDENTIFIER IS THE HUMAN. Teams hands us several ids that look interchangeable and are not:
 *
 *   activity.from.aadObjectId   the Entra `oid` — THE ONLY canonical identity, measured in R1C-B-1a
 *   activity.from.id            a Bot-Framework-scoped `29:…` address, per bot, NOT a person
 *   provider_id / `sub`         per-application, differs between the Supabase app and this bot
 *   email / UPN / displayName   never identity, at any layer
 *
 * So `from.id` is read for nothing, and there is no email field in this module to misuse.
 *
 * CAPTURE != COMMITMENT. Nothing here derives a deadline, a title, a priority or a category. The
 * output is where it came from, how to recognise it again, and how to open it — and the existing
 * `resolveTeamsCaptureSource` still owns `source_type` / `external_key`, which is why this module
 * deliberately stops short of producing them.
 */

import type { TeamsCaptureInput } from "@/domain/action-capture/captureSource";
import { CAPTURE_PROVIDER_TEAMS, PREVIEW_MAX } from "@/domain/action-capture/captureSource";

/**
 * The two invoke names a message action can arrive under, and nothing else.
 *
 * Which one Teams sends is decided by the manifest, not by us: a command with `fetchTask: true`
 * (no input form — the one-tap experience this product wants) arrives as `fetchTask`, while a
 * command with a form arrives as `submitAction`. Both carry the same `value.messagePayload`, so
 * both are answered rather than betting the integration on one manifest flag. Handling both is
 * safe precisely because the capture is idempotent: if a client ever sent both for one save, the
 * `UNIQUE(user_id, source_type, external_key)` key still yields exactly one row.
 *
 * Anything else — a chat message to the bot, a link unfurl, a card action — is NOT implemented and
 * must get a safe refusal. This is a single-purpose message action, deliberately not a bot.
 */
export const TEAMS_INVOKE_FETCH_TASK = "composeExtension/fetchTask" as const;
export const TEAMS_INVOKE_SUBMIT_ACTION = "composeExtension/submitAction" as const;
export const TEAMS_SUPPORTED_INVOKE_NAMES = [
  TEAMS_INVOKE_FETCH_TASK,
  TEAMS_INVOKE_SUBMIT_ACTION,
] as const;

export type TeamsInvokeName = (typeof TEAMS_SUPPORTED_INVOKE_NAMES)[number];

/** Recorded as provenance so a future @mention path is distinguishable from this one. */
export const CAPTURE_REASON_EXPLICIT_SAVE = "explicit_save" as const;

export type TeamsInvokeParse =
  | { ok: true; invokeName: TeamsInvokeName; tenantId: string; aadObjectId: string; capture: TeamsCaptureInput }
  | {
      ok: false;
      code:
        | "unsupported_invoke"
        | "missing_tenant"
        | "missing_aad_object_id"
        | "missing_conversation"
        | "missing_message";
    };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const opt = (v: unknown): string | null => {
  const s = str(v);
  return s === "" ? null : s;
};
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * A channel message action reports its conversation as `19:…@thread.tacv2;messageid=170…`.
 *
 * That suffix names the MESSAGE, not the conversation, so leaving it in would make the
 * "conversation" segment of the idempotency key different for every message in the same channel —
 * still unique, but no longer meaning what it says, and no longer stable if Teams ever changes
 * which message anchors the thread. The conversational address is the part before the `;`.
 */
export function canonicalConversationId(raw: unknown): string {
  const s = str(raw);
  const cut = s.indexOf(";");
  return (cut >= 0 ? s.slice(0, cut) : s).trim();
}

/**
 * Teams message bodies are HTML. A preview exists so a person recognises the message they saved,
 * so tags are removed and whitespace collapsed; entities that commonly appear in typed text are
 * decoded so the excerpt reads like the message rather than like markup. This is NOT sanitisation
 * for rendering — nothing here is ever injected as HTML — and it is NOT interpretation.
 */
export function previewFromBody(raw: unknown): string | null {
  const s = str(raw);
  if (s === "") return null;
  const text = s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text === "") return null;
  // The capture domain clamps too; clamping here keeps an oversized body out of the payload we
  // hand across the boundary at all, rather than trusting the next layer to drop it.
  return text.slice(0, PREVIEW_MAX);
}

/**
 * Parse a VERIFIED Teams invoke into the identity tuple and the capture payload.
 *
 * Returns a typed refusal rather than throwing: an activity we cannot read is a "this message
 * couldn't be saved" for the user, never a 500 and never a partial write.
 */
export function parseTeamsMessageAction(activity: unknown): TeamsInvokeParse {
  const a = obj(activity);
  const name = str(a.name) as TeamsInvokeName;
  if (!TEAMS_SUPPORTED_INVOKE_NAMES.includes(name)) return { ok: false, code: "unsupported_invoke" };

  const tenantId = str(obj(obj(a.channelData).tenant).id);
  if (!tenantId) return { ok: false, code: "missing_tenant" };

  // `aadObjectId` ONLY. `from.id` is deliberately never read.
  const aadObjectId = str(obj(a.from).aadObjectId);
  if (!aadObjectId) return { ok: false, code: "missing_aad_object_id" };

  const conversationId = canonicalConversationId(obj(a.conversation).id);
  if (!conversationId) return { ok: false, code: "missing_conversation" };

  const payload = obj(obj(a.value).messagePayload);
  const messageId = str(payload.id);
  if (!messageId) return { ok: false, code: "missing_message" };

  const channelId = opt(obj(payload.channelIdentity).channelId);
  // A chat has no channel identity; recording the conversation as the chat id in that case keeps
  // the distinction visible in provenance without letting it reach the identity key.
  const chatId = channelId ? null : conversationId;

  return {
    ok: true,
    invokeName: name,
    tenantId,
    aadObjectId,
    capture: {
      provider: CAPTURE_PROVIDER_TEAMS,
      tenant_id: tenantId,
      conversation_id: conversationId,
      message_id: messageId,
      preview_text: previewFromBody(obj(payload.body).content),
      source_url: opt(payload.linkToMessage),
      sender_display: opt(obj(obj(payload.from).user).displayName),
      captured_at: opt(payload.createdDateTime),
      channel_id: channelId,
      chat_id: chatId,
      capture_reason: CAPTURE_REASON_EXPLICIT_SAVE,
    },
  };
}
