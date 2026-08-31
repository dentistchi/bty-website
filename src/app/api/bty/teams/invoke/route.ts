import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ensureActionCapture } from "@/lib/bty/action-capture/ensureActionCapture.server";
import { resolveBtyUserFromMicrosoftIdentity } from "@/lib/bty/identity-link/microsoftIdentityLink.server";
import { verifyBotFrameworkToken } from "@/lib/bty/teams/botTokenVerifier.server";
import {
  parseTeamsMessageAction,
  TEAMS_INVOKE_FETCH_TASK,
  TEAMS_SUPPORTED_INVOKE_NAMES,
  type TeamsInvokeName,
} from "@/domain/teams/invokeActivity";
import { identifierFingerprint } from "@/lib/bty/teams/identityFingerprint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bty/teams/invoke — the Teams "Save to BTY" message action. Slice T1.
 *
 * TEAMS IS AN INPUT CHANNEL. This route creates a `bty_action_captures` row and NOTHING ELSE. No
 * Action Contract, no deadline, no verification obligation, no XP, no AIR, no Today commitment.
 * "Capture != Commitment" is the whole product decision, and this route is where it is kept.
 *
 * THE ORDER OF OPERATIONS IS THE SECURITY MODEL:
 *
 *   1. verify the Bot Framework token          ← until this passes, the body is attacker input
 *   2. parse the activity                      ← pure, no I/O, returns a refusal not an exception
 *   3. resolve (tid, aadObjectId) -> BTY user  ← the ONLY identity authority
 *   4. create the capture for THAT user id
 *
 * Nothing is read from the body before step 1, and `user_id` is never read from the body at all —
 * it is derived in step 3 or the request does not write.
 *
 * WHY SERVICE-ROLE IS SAFE HERE. There is no browser session on a Teams invoke, and
 * `bty_action_captures` is RLS-on with zero policies, so the write must go through the admin
 * client. That client is a transport, NOT an authority: the only user id it may write is the one
 * the resolver returned for a Microsoft-signed caller. A service-role client that wrote a
 * body-supplied id would be an authority, which is exactly the mistake this shape prevents.
 *
 * NO GRAPH. Teams delivers the selected message in the invoke itself, so this integration holds
 * zero delegated and zero application Microsoft Graph permissions and reads no other message.
 */

/**
 * Teams renders this text to the user. Calm, specific, and never technical.
 *
 * The envelope differs by invoke: a `fetchTask` expects a `task` response, a `submitAction` expects
 * a `composeExtension` one. Replying in the wrong shape shows a generic Teams error even though the
 * save succeeded, so the shape follows the request rather than a fixed choice.
 *
 * WHY A CARD AND NOT `type: "message"`. The documented contract offers both -- "`continue` to
 * present a form, or `message` for a simple pop-up" -- and `message` is what this returned first,
 * because a one-line confirmation is exactly a simple pop-up. On the Founder's iPhone it rendered
 * NOTHING, twice, on invokes that were otherwise completely successful: JWT valid, identity
 * RESOLVED, capture written, HTTP 200. The save worked and the person could not tell.
 *
 * So this returns the other documented shape: `continue` with the smallest possible Adaptive Card.
 * I could not find documentation stating that mobile drops `type: "message"`, so this is a change
 * made on device evidence rather than on a citation -- worth knowing if it ever needs revisiting.
 *
 * The card is deliberately one line with NO input fields and NO submit action: the product
 * requirement is tap -> confirmation -> done, and anything the user must fill in or press would be
 * a form we do not need. A dialog they dismiss is the smallest thing the platform will actually
 * show them.
 */
const ADAPTIVE_CARD = "application/vnd.microsoft.card.adaptive";

function confirmationCard(text: string) {
  return {
    title: "BTY",
    height: "small",
    width: "small",
    card: {
      contentType: ADAPTIVE_CARD,
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        body: [{ type: "TextBlock", text, wrap: true, size: "Medium" }],
      },
    },
  };
}

function say(text: string, invokeName?: TeamsInvokeName) {
  return invokeName === TEAMS_INVOKE_FETCH_TASK
    ? NextResponse.json({ task: { type: "continue", value: confirmationCard(text) } })
    : NextResponse.json({ composeExtension: { type: "message", text } });
}

const MSG = {
  saved: "Saved to BTY.",
  signIn: "Sign in to BTY with Microsoft first.",
  cannotSave: "This message couldn't be saved to BTY.",
  serverBusy: "BTY couldn't save this yet.",
} as const;

export async function POST(req: NextRequest) {
  // 1. AUTHENTICATE FIRST. The body is not read until this passes.
  const verified = await verifyBotFrameworkToken(
    req.headers.get("authorization"),
    process.env.TEAMS_BOT_APP_ID,
  );
  if (!verified.ok) {
    // 401 with no detail. The sanitized reason is already logged by the verifier.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let activity: unknown;
  try {
    activity = await req.json();
  } catch {
    return say(MSG.cannotSave);
  }

  // 2. PARSE (pure). An invoke this slice does not implement gets a safe refusal — this is a
  //    single-purpose message action, deliberately not a general bot.
  const parsed = parseTeamsMessageAction(activity);
  if (!parsed.ok) {
    // TEMPORARY (T1 first-invoke diagnosis). The first real mobile tap was refused here, and the
    // log said only what we ACCEPT -- never what ARRIVED -- so the one fact needed to explain it
    // was the one fact not recorded. These are shape facts, not user data: an activity type and
    // name, and booleans for whether the identity and payload fields were present at all. No id,
    // no tenant, no message text. Remove once the received activity is known.
    const a = (activity ?? {}) as Record<string, unknown>;
    const o = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
    console.error("[teams-invoke] activity refused", {
      code: parsed.code,
      receivedType: typeof a.type === "string" ? a.type : "(none)",
      receivedName: typeof a.name === "string" ? a.name : "(none)",
      supported: TEAMS_SUPPORTED_INVOKE_NAMES,
      hasTenantId: typeof o(o(a.channelData).tenant).id === "string",
      hasAadObjectId: typeof o(a.from).aadObjectId === "string",
      hasMessagePayload: Object.keys(o(o(a.value).messagePayload)).length > 0,
      topLevelKeys: Object.keys(a).slice(0, 12),
      // `missing_message` means the payload arrived but carried no usable id. Two candidates,
      // and these three lines separate them without printing a single value: the id may sit
      // under a different key (key NAMES tell us), or it may be a JSON number rather than a
      // string, which the string helper silently drops (typeof tells us).
      valueKeys: Object.keys(o(a.value)).slice(0, 12),
      messagePayloadKeys: Object.keys(o(o(a.value).messagePayload)).slice(0, 20),
      messageIdType: typeof o(o(a.value).messagePayload).id,
    });
    return say(MSG.cannotSave);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error("[teams-invoke] admin client unavailable");
    return say(MSG.serverBusy, parsed.invokeName);
  }

  // 3. IDENTITY. `aadObjectId` is the Entra `oid`; `from.id` and email are never consulted.
  const resolution = await resolveBtyUserFromMicrosoftIdentity(admin, parsed.tenantId, parsed.aadObjectId);

  // The first-invoke identity gate (Slice T1 §G). Fingerprints only — one-way, 8 hex wide, enough
  // to compare two observations and useless for reconstructing an identifier. A RESOLVED status is
  // itself the proof that `aadObjectId` equals the stored `oid`, because the resolver matches on
  // exact lower-cased equality of both segments; these lines exist so a human can SEE that.
  console.info("[teams-invoke] identity gate", {
    status: resolution.status,
    teams_tid_fp: await identifierFingerprint(parsed.tenantId),
    teams_oid_fp: await identifierFingerprint(parsed.aadObjectId),
  });

  if (resolution.status !== "RESOLVED") {
    // NOT_LINKED must never create a user, and an ambiguous or failed lookup must never guess one.
    return say(resolution.status === "NOT_LINKED" ? MSG.signIn : MSG.serverBusy, parsed.invokeName);
  }

  // 4. CAPTURE. Idempotent by `UNIQUE(user_id, source_type, external_key)`; a repeat save returns
  //    the original row untouched. The user's intent is satisfied either way, so a duplicate reads
  //    as success rather than as an error they cannot act on.
  const result = await ensureActionCapture(admin, {
    userId: resolution.userId,
    input: parsed.capture,
  });
  if (!result.ok) {
    console.error("[teams-invoke] capture failed", { code: result.code });
    // A source we cannot read is the user's message being unusable; everything else is ours.
    const sourceProblem = result.code === "unsupported_provider" || result.code === "missing_identifier";
    return say(sourceProblem ? MSG.cannotSave : MSG.serverBusy, parsed.invokeName);
  }

  return say(MSG.saved, parsed.invokeName);
}
