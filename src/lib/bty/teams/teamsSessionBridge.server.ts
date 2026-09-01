/**
 * Teams tab → Supabase session bridge. Slice A0. SERVER ONLY.
 *
 * ONE IDENTITY AUTHORITY, ONE SESSION AUTHORITY, TWO TRANSPORTS.
 *
 * Identity stays exactly where it already was: `tenant id + Entra oid` →
 * `bty_resolve_user_from_microsoft_identity` → `auth.identities(provider='azure')` →
 * `auth.users.id`. This module adds no table, no mapping, no merge and no second lookup.
 *
 * Session stays exactly where it already was: a genuine Supabase session, the same kind the
 * cookie path produces, understood by the same `getUser()`, the same `auth.uid()` and the same
 * RLS. Only the TRANSPORT differs — web and native carry it in cookies, the Teams tab carries it
 * in an `Authorization` header, because a Teams tab is a third-party browsing context and
 * Microsoft documents that Teams iOS cannot complete a cookie-based auth flow at all.
 *
 * WHY generateLink → verifyOtp, AND WHAT WAS MEASURED BEFORE WRITING THIS.
 *
 * `@supabase/auth-js` exposes exactly eight admin methods — signOut, inviteUserByEmail,
 * generateLink, createUser, listUsers, getUserById, updateUserById, deleteUser. There is no
 * `createSession`, no admin session mint and no external-token exchange, so "the server mints a
 * session" is not an available operation. `signInWithIdToken` is available and does not apply:
 * the Teams token's audience is `api://<host>/botid-<botAppId>`, not the Supabase Azure app's
 * client id, so GoTrue rejects it. `generateLink` → `verifyOtp` is the one supported path that
 * yields a real session for an ALREADY-RESOLVED user with no user-facing sign-in flow.
 *
 * It was executed end to end on a disposable GoTrue v2.186.0 / PostgreSQL 17.6 stack against a
 * fixture shaped exactly like production (azure + google identities, no email identity). Full
 * auth-schema snapshots before and after were byte-identical except for the one session and one
 * refresh token it is supposed to create — no new user, no email identity, azure `tid`/`oid`
 * untouched, `app_metadata` untouched — and that held across ~85 repeated cycles. The hashed
 * token is single-use (a replay returns 403), `generateLink` sends no email (proven against a
 * live mail sink with a working control), and the resulting session satisfies `getUser()`,
 * `auth.uid()` under RLS, refresh, and revocation on sign-out.
 *
 * A control user that was NEVER bridged proved the other half: it is exactly as
 * magic-link-requestable as the bridged one. This bridge causes NO auth-method expansion — it
 * neither widens nor narrows how an account can be authenticated.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { resolveBtyUserFromMicrosoftIdentity } from "@/lib/bty/identity-link/microsoftIdentityLink.server";
import type { TabSsoIdentity } from "@/lib/bty/teams/tabSsoTokenVerifier.server";

/** Exactly the session material the tab needs to call `setSession`, and nothing else. */
export type TeamsBridgeSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number | null;
};

export type TeamsBridgeResult =
  | { ok: true; session: TeamsBridgeSession }
  /** The person has a Microsoft account and no BTY account yet. NOTHING was written. */
  | { ok: false; kind: "needs_first_sign_in" }
  | {
      ok: false;
      kind: "failed";
      reason:
        | "not_configured"
        | "identity_ambiguous"
        | "identity_lookup_failed"
        | "user_unreadable"
        | "no_addressable_email"
        | "link_user_mismatch"
        | "link_failed"
        | "session_user_mismatch"
        | "verify_failed";
      /** True when Supabase refused for rate reasons; the caller answers 429, not 500. */
      rateLimited?: boolean;
    };

function anonClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // `verifyOtp` must run as an ordinary caller: it is exchanging a one-time token for a session,
  // which is not an admin operation and must not be performed with service-role authority.
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Supabase signals throttling with 429; anything else is ours to own. */
function isRateLimited(status: unknown): boolean {
  return status === 429;
}

/**
 * Exchange a VERIFIED Microsoft identity for a genuine Supabase session.
 *
 * `identity` must already have been established by `verifyTeamsTabSsoToken`. This function
 * authenticates nothing — it looks up what a trusted caller proved, and refuses on every path it
 * cannot complete honestly.
 */
export async function bridgeTeamsIdentityToSession(
  admin: SupabaseClient,
  identity: TabSsoIdentity,
): Promise<TeamsBridgeResult> {
  const anon = anonClient();
  if (!anon) {
    console.error("[teams-bootstrap] anon client unavailable");
    return { ok: false, kind: "failed", reason: "not_configured" };
  }

  // 1. IDENTITY FIRST. The only lookup, unchanged, and the only thing that decides WHO this is.
  const resolution = await resolveBtyUserFromMicrosoftIdentity(admin, identity.tenantId, identity.aadObjectId);
  if (resolution.status === "NOT_LINKED") return { ok: false, kind: "needs_first_sign_in" };
  if (resolution.status === "AMBIGUOUS_IDENTITY") {
    console.error("[teams-bootstrap] refused: ambiguous identity");
    return { ok: false, kind: "failed", reason: "identity_ambiguous" };
  }
  if (resolution.status !== "RESOLVED") {
    console.error("[teams-bootstrap] refused: identity lookup failed", { status: resolution.status });
    return { ok: false, kind: "failed", reason: "identity_lookup_failed" };
  }
  const userId = resolution.userId;

  // 2. The email is READ SERVER-SIDE from the already-resolved user id.
  const { data: found, error: readErr } = await admin.auth.admin.getUserById(userId);
  if (readErr || !found?.user) {
    console.error("[teams-bootstrap] refused: resolved user unreadable");
    return { ok: false, kind: "failed", reason: "user_unreadable" };
  }
  const email = (found.user.email ?? "").trim();
  if (!email) {
    // Fail closed. There is deliberately NO fallback that looks a user up BY email — that would
    // make email an identity authority, which it is not and must never become.
    console.error("[teams-bootstrap] refused: resolved user has no addressable email");
    return { ok: false, kind: "failed", reason: "no_addressable_email" };
  }

  /*
    Email is used only as a GoTrue addressing handle for a user whose identity has already been
    established by tenant id + Entra oid. Email is never an identity claim, lookup key, merge
    authority, or client-supplied value.

    Measured, not assumed: this call creates no user, adds no `email` identity, and leaves
    `app_metadata.provider` / `providers` and the azure identity's `tid`/`oid` untouched. It also
    sends no email — that is what distinguishes it from `inviteUserByEmail`, and it is why it
    cannot consume the project's email-sending quota.
  */
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link?.properties?.hashed_token) {
    const status = (linkErr as { status?: unknown } | null)?.status;
    console.error("[teams-bootstrap] refused: link generation failed", { rateLimited: isRateLimited(status) });
    return { ok: false, kind: "failed", reason: "link_failed", rateLimited: isRateLimited(status) };
  }

  // 3. The user the link was minted for MUST be the user identity resolved. If GoTrue ever
  //    addressed a different account, that is the moment to stop — never to continue and hope.
  if (link.user?.id !== userId) {
    console.error("[teams-bootstrap] refused: generated link addressed a different user");
    return { ok: false, kind: "failed", reason: "link_user_mismatch" };
  }

  // 4. Redeem the single-use token for a real session. `type: 'email'` is the generic token-hash
  //    type; `'magiclink'` also works but encodes a link semantic this flow does not use.
  const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });
  if (verifyErr || !verified?.session || !verified.user) {
    const status = (verifyErr as { status?: unknown } | null)?.status;
    console.error("[teams-bootstrap] refused: otp verification failed", { rateLimited: isRateLimited(status) });
    return { ok: false, kind: "failed", reason: "verify_failed", rateLimited: isRateLimited(status) };
  }

  // 5. The session MUST belong to the resolved user. Asserted rather than assumed, because a
  //    session for the wrong person is the one failure this whole design exists to make impossible.
  if (verified.user.id !== userId) {
    console.error("[teams-bootstrap] refused: session user is not the resolved user");
    return { ok: false, kind: "failed", reason: "session_user_mismatch" };
  }

  const s = verified.session;
  return {
    ok: true,
    session: {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_in: typeof s.expires_in === "number" ? s.expires_in : 3600,
      expires_at: typeof s.expires_at === "number" ? s.expires_at : null,
    },
  };
}
