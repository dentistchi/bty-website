import { NextRequest, NextResponse } from "next/server";
import { readBootTimeline } from "@/domain/teams/bootDiagnostics";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCfClientIp, rateLimitKV } from "@/lib/rate-limit";
import { verifyTeamsTabSsoToken } from "@/lib/bty/teams/tabSsoTokenVerifier.server";
import { bridgeTeamsIdentityToSession } from "@/lib/bty/teams/teamsSessionBridge.server";
import { bindAnnouncementRecipients } from "@/lib/bty/announcement/trackAnnouncement.server";
import { evaluateMicrosoftManagerEntitlement } from "@/lib/bty/foundry/events/microsoftManagerSync.server";
import { bindDirectoryAuthorityUser } from "@/lib/bty/microsoft/directoryAuthority.server";
import { bindTeamsTrainingParticipants } from "@/lib/bty/foundry/teams/bindTeamsParticipants.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/teams-bootstrap — the Teams Personal App's one authenticated handshake. Slice A0.
 *
 * THE ORDER OF OPERATIONS IS THE SECURITY MODEL, and it is the same shape the Teams invoke route
 * already uses:
 *
 *   1. verify the Teams TAB SSO Entra token   ← until this passes, nothing in the request is real
 *   2. extract tid + oid, and only those
 *   3. resolve the canonical BTY user via the existing Microsoft-first resolver
 *   4. exchange that resolved user for a genuine Supabase session
 *
 * The authenticated branch only uses the verified Authorization header. Tokenless
 * diagnostics have their own bounded branch and cannot establish a session.
 *
 * THE ENTRA TOKEN'S AUTHORITY ENDS HERE. What leaves this route is a Supabase session — the same
 * credential type the cookie path produces. No other BTY route learns to verify an Entra token,
 * and `requireUser` is never taught to; it only ever sees Supabase access tokens.
 *
 * NOTHING IS WRITTEN FOR AN UNRESOLVED PERSON. A Microsoft user with no BTY account gets
 * `needsFirstSignIn`, and this route creates no user, no identity and no session for them.
 *
 * WHAT THE RESPONSE CARRIES: the session material the tab needs, and nothing else. No email, no
 * magic link, no hashed token, no user metadata, no identity claims.
 */

/** Never cache an auth handshake, at any layer. */
function json(body: unknown, status: number) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

const CLIENT_ERROR_HEADER = "x-bty-teams-client-error";
const CLIENT_FAILURE_STEPS = new Set([
  "import_teams_js",
  "app_initialize",
  "get_auth_token",
  "bootstrap_http_failure",
  "set_session_failure",
  "notify_success_failure",
]);
const MAX_DIAGNOSTIC_BYTES = 8192;

async function readDiagnosticBody(req: NextRequest): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) return null;

  const bytes = new Uint8Array(MAX_DIAGNOSTIC_BYTES);
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.byteLength > bytes.byteLength) {
        void reader.cancel().catch(() => {});
        return null;
      }
      bytes.set(value, length);
      length += value.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes.subarray(0, length)));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

/** Record bounded, credential-free telemetry once per attempt. Boot never depends on this write. */
async function persistBootFailure(req: NextRequest, step: string): Promise<void> {
  try {
    const limit = await rateLimitKV({
      endpoint: "teams-boot-diagnostic",
      identifier: getCfClientIp(req),
      limit: 20,
      windowSeconds: 60,
    }).catch(() => null);
    if (!limit?.allowed) return;

    const timeline = readBootTimeline(await readDiagnosticBody(req));
    if (!timeline || !/_(failure|timeout)$/.test(timeline.terminalStage)) return;

    const admin = getSupabaseAdmin();
    if (!admin) return;
    const { error } = await admin.from("mvp_debug_reports").upsert({
      id: timeline.bootAttemptId,
      title: `teams_boot_failed: ${timeline.terminalStage}`,
      description: `Teams tab boot stopped at ${timeline.terminalStage}. Reported step: ${step}.`,
      route: "/teams",
      context: {
        kind: "teams_boot_failure",
        bootAttemptId: timeline.bootAttemptId,
        terminalStage: timeline.terminalStage,
        buildSha: timeline.buildSha,
        platform: timeline.platform,
        events: timeline.events,
      },
      created_by: null,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      console.error("[teams-bootstrap] diagnostic persistence failed", { code: error.code ?? "unknown" });
    }
  } catch {
    // A failed diagnostic write must not affect sign-in.
    console.warn("[teams-bootstrap] diagnostic unavailable");
  }
}

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  const clientError = req.headers.get(CLIENT_ERROR_HEADER);
  if (!authorization && clientError !== null) {
    if (CLIENT_FAILURE_STEPS.has(clientError)) await persistBootFailure(req, clientError);
    return json({ error: "Unauthorized" }, 401);
  }

  const verified = await verifyTeamsTabSsoToken(authorization);
  if (!verified.ok) {
    // 401 with no detail. The sanitized reason is already logged by the verifier.
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error("[teams-bootstrap] admin client unavailable");
    return json({ error: "unavailable" }, 503);
  }

  // 2-4. Identity, then session. The service owns both and refuses on every path it cannot
  //      complete honestly; this handler only maps the verdict onto a status code.
  const result = await bridgeTeamsIdentityToSession(admin, verified.identity);

  if (result.ok) {
    /*
      Slice A1 — bind any announcement recipient rows frozen for this Microsoft identity.
      
      This is the ONE place it belongs: the identity has just been verified and resolved, so both
      halves of the tuple are trustworthy and the canonical user id is known. It creates nothing —
      a recipient row is never permission to make an account — and it is idempotent, so the
      overwhelmingly common case (no pending rows) costs one indexed lookup.

      Deliberately NOT awaited into the failure path: a person's sign-in must never fail because a
      binding did. The function already swallows its own errors and returns 0.
    */
    await bindAnnouncementRecipients(
      admin,
      result.userId,
      verified.identity.tenantId,
      verified.identity.aadObjectId,
    );
    await bindDirectoryAuthorityUser(admin, result.userId, verified.identity.tenantId, verified.identity.aadObjectId);
    /*
      Teams Chat-Native Training V1 — settle any training this person completed in a Teams chat
      BEFORE they had a BTY account.

      Same place, same reasoning, same guarantees as the two bindings above: the identity has just
      been verified and resolved, nothing is created, a row already bound to someone else is never
      re-pointed, and a failure is swallowed rather than allowed to fail a sign-in. What it adds is
      the account side of a completion that was already real — the XP that had nobody to belong to.
    */
    await bindTeamsTrainingParticipants(
      admin,
      result.userId,
      verified.identity.tenantId,
      verified.identity.aadObjectId,
    );
    /*
      Microsoft Manager Authority V1 — settle Host entitlement at ACTIVATION.

      This is the answer to "a Microsoft manager who has never opened BTY". Nothing about them is
      recorded upstream and no account is fabricated for them; the first time they genuinely sign
      in, their canonical user id exists, and their manager entitlement is evaluated here on the
      identity this route has just verified — tenant + oid, never an email.

      Deliberately not in the failure path, and deliberately throttled (the function returns early
      unless entitlement is stale): a person's sign-in must never fail, or visibly slow, because
      Microsoft Graph was unreachable. A failed probe changes no authority at all.
    */
    await evaluateMicrosoftManagerEntitlement(
      admin,
      result.userId,
      verified.identity.tenantId,
      verified.identity.aadObjectId,
    );

    return json({ session: result.session }, 200);
  }

  if (result.kind === "needs_first_sign_in") {
    // 200, not 401: the caller IS authenticated to Microsoft. What is missing is a BTY account,
    // which is a product state the tab handles, not an authentication failure to retry.
    return json({ needsFirstSignIn: true }, 200);
  }

  // A throttled Supabase must reach the tab as 429 so it backs off rather than treating a
  // temporary limit as a broken deployment.
  if (result.rateLimited) return json({ error: "rate_limited" }, 429);

  return json({ error: "bootstrap_failed" }, 503);
}
