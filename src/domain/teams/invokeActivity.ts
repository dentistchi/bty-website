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
 * A Teams message id, normalised to a string.
 *
 * MEASURED ON THE WIRE, not taken from the docs. Microsoft's published fetchTask example shows
 * `"id": "1611060744833"` -- a string -- and the iPhone Teams client sends the same field as a
 * JSON NUMBER. Reading it as a string only meant every real mobile save was refused as
 * `missing_message` while the payload was in fact complete.
 *
 * A number is therefore accepted and stringified, which also keeps the idempotency key identical
 * across clients: the same message saved from mobile and from desktop must produce one capture,
 * and it would not if one platform's id round-tripped differently. Everything else is still
 * rejected -- booleans, objects, NaN and Infinity included -- so the field stays fail-closed.
 */
export function messageIdOf(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return "";
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
  const messageId = messageIdOf(payload.id);
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

// ===========================================================================
// SLICE A1 — the SECOND message action: Track with BTY.
//
// ADDITIVE. Everything above is untouched: `parseTeamsMessageAction` still
// returns exactly what it returned for T1, and the Save to BTY path does not
// read a single new field. The two commands are told apart by `value.commandId`,
// which was already present on the real wire (measured on the Founder's iPhone,
// 2026-08-31: `commandId: "saveToBty"`), so distinguishing them needs no new
// platform dependency.
// ===========================================================================

/** The two commands this app exposes. Anything else is refused. */
export const TEAMS_COMMAND_SAVE = "saveToBty" as const;
export const TEAMS_COMMAND_TRACK = "trackWithBty" as const;
export type TeamsCommandId = typeof TEAMS_COMMAND_SAVE | typeof TEAMS_COMMAND_TRACK;

/**
 * Which command a verified invoke is for.
 *
 * Returns null for an unknown id rather than defaulting to Save — a silent
 * default is how a future command would quietly write the wrong object.
 */
export function readCommandId(activity: unknown): TeamsCommandId | null {
  const id = str(obj(obj(activity).value).commandId);
  return id === TEAMS_COMMAND_SAVE || id === TEAMS_COMMAND_TRACK ? id : null;
}

export type TeamsTrackSubmission =
  | { ok: true; hostFraming: string; pickedRaw: string }
  | { ok: false; code: "missing_framing" | "missing_recipients" };

/**
 * Read the Track dialog's submitted fields, and ONLY those.
 *
 * A dialog submit arrives as `composeExtension/submitAction` with the form values under
 * `value.data`. Exactly two keys are read; anything else the client sends is ignored rather than
 * merged, so a crafted payload cannot introduce a field this product does not have.
 *
 * The recipient string is returned RAW and canonicalised elsewhere
 * (`parsePickedRecipients`), so the identity rule lives in one place rather than
 * in whichever parser happened to see the value first.
 */
export function parseTeamsTrackSubmission(activity: unknown): TeamsTrackSubmission {
  const data = obj(obj(obj(activity).value).data);
  const hostFraming = str(data.hostFraming);
  if (!hostFraming) return { ok: false, code: "missing_framing" };
  const pickedRaw = str(data.recipients);
  if (!pickedRaw) return { ok: false, code: "missing_recipients" };
  return { ok: true, hostFraming, pickedRaw };
}

// ===========================================================================
// SLICE A0.1 — the ROUTING COORDINATE.
//
// ADDITIVE and read-only: nothing above changes, no existing parse reads this,
// and NOTHING here sends a message. This slice captures where a Teams message
// to a recipient would have to be posted, so that a later slice can post one.
//
// WHY IT IS NEEDED AT ALL. A recipient who has never opened BTY is currently
// never told that anything was sent to them. Reaching them means a Bot
// Framework call to a per-tenant, per-region base URL that arrives on the
// invoke as `serviceUrl` -- and BTY has always thrown it away.
//
// WHY IT IS NOT HARDCODED. Every Bot Framework sample shows one particular
// regional base URL, and writing that literal down anywhere -- a constant, a
// fallback, even a comment -- is how it gets copied into a fallback later. It
// is regional, it is not promised to be stable, and a wrong routing base is not
// a silent no-op: it is a real request to a real Microsoft endpoint about a
// real person. Observed or NULL; never assumed.
// ===========================================================================

/** Long enough for any real Bot Framework endpoint, short enough to bound the column. */
const SERVICE_URL_MAX = 400;

/**
 * An absolute https origin, optionally with a path. Deliberately strict:
 *
 *   * `https` only -- a routing base is where a bot token is presented, and
 *     presenting one over plaintext would leak it.
 *   * no credentials, no query, no fragment: those are not part of a base URL,
 *     and accepting them would let a crafted value smuggle state into every
 *     future request built from it.
 *   * host characters only, so `javascript:`, a relative path, a bare host and
 *     `https://evil@host/` all fail rather than being coerced into something.
 */
const SERVICE_URL_SHAPE = /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?(\/[a-z0-9\-._~/%]*)?$/i;

/** Trailing slashes carry no meaning for a base URL, and the two sources spell them differently. */
const forCompare = (s: string): string => s.trim().toLowerCase().replace(/\/+$/, "");

export type ServiceUrlReason = "ok" | "absent" | "invalid" | "mismatch";
export type ServiceUrlResolution = { url: string | null; reason: ServiceUrlReason };

/**
 * The routing coordinate for a VERIFIED invoke, or null with a reason.
 *
 * AUTHORITY IS THE ACTIVITY, AND THE TOKEN IS A CONSTRAINT ON IT. `serviceUrl`
 * is read from the activity body -- which is only trustworthy because the route
 * verifies the Bot Framework JWT BEFORE it reads the body at all, so a browser,
 * a curl, or the Track dialog's own form data can never reach this function.
 *
 * A Bot Framework token may also carry a `serviceUrl` claim. Where it does, the
 * two must agree, and a disagreement yields NOTHING: that combination means
 * either a replayed token or a body edited in flight, and neither is a value
 * worth keeping. The claim is used ONLY to refuse -- never as a substitute
 * source -- because whether our production tokens carry it is not yet measured,
 * and a silent fallback would make the authority depend on which unmeasured
 * branch happened to fire.
 *
 * `reason` exists so the caller can say WHICH of "Teams did not send one" and
 * "we refused the one it sent" happened. Those need different responses from a
 * human, and one of them is the open question this slice was built to answer.
 *
 * NEVER THROWS AND NEVER BLOCKS. Every refusal is a null, because routing
 * metadata must not be able to stop a Host from tracking a message.
 */
export function resolveServiceUrl(activity: unknown, tokenClaim?: unknown): ServiceUrlResolution {
  const raw = str(obj(activity).serviceUrl);
  if (raw === "") return { url: null, reason: "absent" };
  if (raw.length > SERVICE_URL_MAX || !SERVICE_URL_SHAPE.test(raw)) {
    return { url: null, reason: "invalid" };
  }

  const claim = str(tokenClaim);
  if (claim !== "" && forCompare(claim) !== forCompare(raw)) {
    return { url: null, reason: "mismatch" };
  }

  // The EXACT field as Teams sent it, only trimmed. Normalisation is for
  // comparison; what gets stored is what was observed.
  return { url: raw, reason: "ok" };
}
