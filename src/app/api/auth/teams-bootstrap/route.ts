import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyTeamsTabSsoToken } from "@/lib/bty/teams/tabSsoTokenVerifier.server";
import { bridgeTeamsIdentityToSession } from "@/lib/bty/teams/teamsSessionBridge.server";

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
 * THE BODY IS NEVER READ. Not for a user id, not for an email, not for a tenant. There is no
 * `req.json()` call in this file, so there is no field a client could supply that this route
 * could be persuaded to trust. The only input authority is the Authorization header.
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

/**
 * A tokenless beacon for failures that happen BEFORE this route is reachable (Slice A0-RUNTIME).
 *
 * If TeamsJS fails to load, `app.initialize()` rejects, or `getAuthToken()` refuses, the tab never
 * sends a request — so a live tail sees nothing, and "nothing" is ambiguous: it reads identically
 * to a person who never tapped. This lets the client say WHICH pre-bootstrap step failed, using
 * the endpoint that already exists.
 *
 * The value is clamped to a short opaque code and nothing else is read from it. The request still
 * carries no token and still gets the same 401 — this changes no behaviour, only observability.
 */
const CLIENT_ERROR_HEADER = "x-bty-teams-client-error";

export async function POST(req: NextRequest) {
  const clientError = (req.headers.get(CLIENT_ERROR_HEADER) ?? "").trim().slice(0, 64);
  if (clientError) {
    console.error("[teams-bootstrap] client reported a pre-bootstrap failure", {
      step: clientError.replace(/[^a-zA-Z0-9._:-]/g, ""),
    });
  }

  // 1. AUTHENTICATE FIRST.
  const verified = await verifyTeamsTabSsoToken(req.headers.get("authorization"));
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
