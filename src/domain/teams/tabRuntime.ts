/**
 * Teams Personal Tab runtime predicates — PURE. Slice A0.
 *
 * No I/O, no DOM, no SDK. Three questions get asked from several places (the Supabase client
 * factory, the fetch transport, the containment guard) and each of them is the kind of rule that
 * gets re-derived slightly differently at every call site until two of them disagree.
 */

/**
 * Is this document the Teams TAB ITSELF (as opposed to the sign-in popup under `/teams/link`)?
 *
 * The distinction is load-bearing and not cosmetic:
 *
 *   `/teams`       runs inside a Teams iframe/WebView — a THIRD-PARTY browsing context. Its
 *                  session must live in memory only, because Teams iOS blocks third-party cookies
 *                  and third-party storage partitioning makes anything durable unreliable.
 *   `/teams/link`  runs inside a Teams-opened POPUP, where `arena.btydaily.com` is the TOP-LEVEL
 *                  document and therefore first-party. The existing Supabase Azure OAuth needs
 *                  ordinary persistence there — the PKCE verifier has to survive the round trip to
 *                  Microsoft and back, and it does, precisely because the popup is not framed.
 *
 * So the popup keeps the app's normal storage behaviour and the tab gets memory-only. Collapsing
 * the two would break first-ever sign-in while looking like a tidying-up.
 */
export function isTeamsTabPath(pathname: string | null | undefined): boolean {
  const p = (pathname ?? "").trim();
  return p === "/teams" || p === "/teams/";
}

/**
 * Should this request URL carry the Teams tab's Supabase bearer token?
 *
 * ONLY same-origin BTY API calls. The token is a real Supabase access token, so attaching it to
 * anything else — a CDN image, an "Open in Teams" link, a Microsoft endpoint, any third party —
 * would be handing a session credential to a host that has no business holding one.
 *
 * @param rawUrl   the request URL exactly as the caller passed it (may be relative)
 * @param origin   the tab document's own origin
 */
export function shouldAttachBearer(rawUrl: string, origin: string): boolean {
  let target: URL;
  try {
    target = new URL(rawUrl, origin);
  } catch {
    return false;
  }
  if (target.origin !== origin) return false;
  return target.pathname === "/api" || target.pathname.startsWith("/api/");
}

/**
 * Would following this href navigate the Teams iframe AWAY from `/teams`?
 *
 * Every BTY route outside `/teams` is served with `X-Frame-Options: DENY`, so such a navigation
 * does not "go somewhere else" — it blanks the tab, with no error and nothing to go back to. The
 * containment guard uses this to send those links out to a real browser instead.
 *
 * A cross-origin href is also "leaving", and also belongs in a browser rather than in the frame.
 */
export function escapesTeamsFrame(rawUrl: string, origin: string): boolean {
  const raw = (rawUrl ?? "").trim();
  // In-page anchors and non-navigating schemes stay put.
  if (raw === "" || raw.startsWith("#")) return false;
  if (/^(mailto:|tel:|sms:|javascript:|blob:|data:)/i.test(raw)) return false;
  let target: URL;
  try {
    target = new URL(raw, origin);
  } catch {
    return false;
  }
  if (target.origin !== origin) return true;
  return !(target.pathname === "/teams" || target.pathname.startsWith("/teams/"));
}
