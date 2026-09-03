import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ensureActionCapture } from "@/lib/bty/action-capture/ensureActionCapture.server";
import { resolveBtyUserFromMicrosoftIdentity } from "@/lib/bty/identity-link/microsoftIdentityLink.server";
import { verifyBotFrameworkToken } from "@/lib/bty/teams/botTokenVerifier.server";
import {
  parseTeamsMessageAction,
  parseTeamsTrackSubmission,
  readCommandId,
  TEAMS_COMMAND_TRACK,
  TEAMS_INVOKE_FETCH_TASK,
  type TeamsInvokeName,
} from "@/domain/teams/invokeActivity";
import { trackDialogCard, trackConfirmationCard } from "@/lib/bty/teams/trackDialogCard";
import { trackAnnouncement } from "@/lib/bty/announcement/trackAnnouncement.server";
import { canTrackWithBty } from "@/lib/bty/authority/platformAdmin.server";

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

/** A dialog (or a confirmation) rather than a bare message — see the card note above. */
function dialog(value: unknown, invokeName?: TeamsInvokeName) {
  return invokeName === TEAMS_INVOKE_FETCH_TASK
    ? NextResponse.json({ task: { type: "continue", value } })
    : NextResponse.json({ task: { type: "continue", value } });
}

const MSG = {
  saved: "Saved to BTY.",
  trackNoFraming: "Add a line about what they should know or do.",
  trackNoPeople: "Choose at least one person.",
  trackNoSource: "BTY couldn't read the original message.",
  trackFailed: "BTY couldn't start tracking this yet.",
  trackNotHost: "Tracking isn't available on your BTY account.",
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
    // A refusal logs its reason code and nothing else. App-lifecycle activities land here too --
    // Teams sends `installationUpdate` and `conversationUpdate` to the same endpoint when the app
    // is installed -- so this path is ordinary traffic, not an incident.
    /*
      Slice A1 — name the command even when the parse failed, because the two failures need
      different words and, more importantly, different diagnosis. A Track submit that arrives
      WITHOUT `messagePayload` is the one platform behaviour this slice could not measure in
      advance (Microsoft's documented submitAction sample is compose-context and does not show
      it). If that is what is happening, it must be loud in the log rather than look like an
      unreadable message.
    */
    const cmd = readCommandId(activity);
    console.error("[teams-invoke] activity refused", { code: parsed.code, command: cmd ?? "unknown" });
    return say(cmd === TEAMS_COMMAND_TRACK ? MSG.trackNoSource : MSG.cannotSave);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error("[teams-invoke] admin client unavailable");
    return say(MSG.serverBusy, parsed.invokeName);
  }

  // 3. IDENTITY. `aadObjectId` is the Entra `oid`; `from.id` and email are never consulted.
  const resolution = await resolveBtyUserFromMicrosoftIdentity(admin, parsed.tenantId, parsed.aadObjectId);

  if (resolution.status !== "RESOLVED") {
    // NOT_LINKED must never create a user, and an ambiguous or failed lookup must never guess one.
    // The status is a fixed enum, never an identifier, so it is safe to record and worth having:
    // it is the difference between "this person has no BTY account" and "the lookup broke".
    console.error("[teams-invoke] identity not resolved", { status: resolution.status });
    return say(resolution.status === "NOT_LINKED" ? MSG.signIn : MSG.serverBusy, parsed.invokeName);
  }

  /*
    3b. WHICH COMMAND (Slice A1). `value.commandId` was already on the real wire before A1 —
    measured on the Founder's iPhone, 2026-08-31 — so telling the two message actions apart needs
    no new platform dependency. An unknown id is refused rather than defaulted to Save: a silent
    default is how a future command quietly writes the wrong object.
  */
  if (readCommandId(activity) === TEAMS_COMMAND_TRACK) {
    /*
      3c. TRACK IS A HOST ACTION (Microsoft Manager Authority V1).

      Teams decides which people SEE a message action; the platform gives an app no way to hide one
      per-user, so an ordinary employee will still find "Track with BTY" in the menu. The server is
      therefore the only place authority can live, and this is that place — ahead of the dialog, so
      a non-Host is refused before the People Picker is ever drawn, and ahead of every write, so a
      submit forged past the dialog is refused too.

      The refusal is deliberately calm and non-technical: someone who is not a lead has done nothing
      wrong, and telling them about grants and entitlements would explain a system they are not in.

      `canTrackWithBty` is the SHARED capability rule -- an active platform admin OR an active
      Foundry Host grant. Track does not get its own notion of who may host, an admin is not a
      special case written into this route, and the client's claims about the user are not
      consulted anywhere: the id comes from the verified Teams identity resolver.
    */
    if (!(await canTrackWithBty(admin, resolution.userId))) {
      console.error("[teams-invoke] track refused: no track capability");
      return say(MSG.trackNotHost, parsed.invokeName);
    }

    // The dialog itself. Nothing is written for merely opening it.
    if (parsed.invokeName === TEAMS_INVOKE_FETCH_TASK) {
      return dialog(trackDialogCard(), parsed.invokeName);
    }

    const submission = parseTeamsTrackSubmission(activity);
    if (!submission.ok) {
      return say(submission.code === "missing_framing" ? MSG.trackNoFraming : MSG.trackNoPeople, parsed.invokeName);
    }

    const tracked = await trackAnnouncement(admin, {
      ownerUserId: resolution.userId,
      capture: parsed.capture,
      hostFramingRaw: submission.hostFraming,
      pickedRaw: submission.pickedRaw,
    });

    if (!tracked.ok) {
      console.error("[teams-invoke] track refused", { reason: tracked.reason });
      const copy =
        tracked.reason === "invalid_framing"
          ? MSG.trackNoFraming
          : tracked.reason === "zero_recipients"
            ? MSG.trackNoPeople
            : MSG.trackFailed;
      return say(copy, parsed.invokeName);
    }

    return dialog(trackConfirmationCard(tracked.count), TEAMS_INVOKE_FETCH_TASK);
  }

  // 4. CAPTURE. Idempotent by `UNIQUE(user_id, source_type, external_key)`; a repeat save returns
  //    the original row untouched. The user's intent is satisfied either way, so a duplicate reads
  //    as success rather than as an error they cannot act on.
  const result = await ensureActionCapture(admin, {
    userId: resolution.userId,
    input: parsed.capture,
    // Explicit: this row exists because the person asked for it to be on their list.
    intent: "save",
  });
  if (!result.ok) {
    console.error("[teams-invoke] capture failed", { code: result.code });
    // A source we cannot read is the user's message being unusable; everything else is ours.
    const sourceProblem = result.code === "unsupported_provider" || result.code === "missing_identifier";
    return say(sourceProblem ? MSG.cannotSave : MSG.serverBusy, parsed.invokeName);
  }

  return say(MSG.saved, parsed.invokeName);
}
