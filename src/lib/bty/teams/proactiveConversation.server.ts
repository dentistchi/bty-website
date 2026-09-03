/**
 * The two Bot Framework Connector calls this product needs. SERVER ONLY, native `fetch`.
 *
 * WHY NO SDK. `botbuilder` exists to run a bot: an adapter, a turn context, state storage, an
 * activity pipeline. BTY does not run a bot — it makes two authenticated POSTs and stores an id.
 * The SDK is added the moment `fetch` is measured insufficient, and not before.
 *
 * ROUTING IS NEVER IMPROVISED. Every call takes the `serviceUrl` recorded on the announcement
 * at Track time. There is no fallback constant and no regional default anywhere in this file:
 * an unroutable announcement is refused upstream, because a guessed base URL is a real request
 * to a real Microsoft endpoint about a real person.
 *
 * ★ EVERY FAILURE SAYS WHETHER IT PROVES NON-DELIVERY. `ambiguous: false` means Microsoft
 * definitively rejected the call and nothing reached anyone -- the caller may free its lease and
 * retry at once. `ambiguous: true` means a message may already be sitting in that person's Teams:
 * a timeout or reset after the POST began, or a 5xx that cannot rule out acceptance. Those must
 * never be retried automatically, so the distinction is made HERE, where the HTTP outcome is
 * actually visible, rather than guessed by a caller reading an error name.
 *
 * ★ EVERY FETCH HAS ITS OWN TIMEOUT, far shorter than the 120-second delivery lease. A request
 * that hangs until the lease expires is the exact shape that lets a second attempt reclaim a row
 * whose send may have succeeded.
 *
 * IDENTITY IS THE ENTRA OBJECT ID. `members: [{ id: aadObjectId }]` with the tenant in
 * `channelData` is the shape Teams documents for reaching a person the bot has never heard from.
 * WHETHER OUR TENANT ACCEPTS IT IS NOT YET MEASURED — no credential has ever existed here, so no
 * call has ever been made. The failure classification below exists precisely so the first real
 * attempt reports what happened instead of being retried blindly.
 */

/** Bot Framework requires the bot's own address in the `28:` form. */
const botAddress = (appId: string) => `28:${appId}`;

export type ConnectorFailure =
  | "not_installed"      // 403 — the app is not installed for this user. The next prerequisite, not a bug.
  | "forbidden"          // 403 that does not read as installation.
  | "unauthorized"       // 401 — token rejected or expired.
  | "invalid_request"    // 4xx — the shape or the identity was not accepted.
  | "throttled"          // 429 — retry later, unchanged.
  | "upstream_error"     // 5xx.
  | "unreachable";       // network.

/** Substantially shorter than the lease, so a live attempt never races its own claim. */
export const CONNECTOR_TIMEOUT_MS = 20_000;

/** Which call was refused. Present so the next failure needs no deduction from database state. */
export type ConnectorOperation = "create_conversation" | "send_activity";

export type ConnectorError = {
  failure: ConnectorFailure;
  /** true when successful delivery cannot be ruled out. NEVER auto-retry these. */
  ambiguous: boolean;
  /** Microsoft's machine-readable `error.code`, when the body carries one. Never prose. */
  microsoftCode?: string;
  /** Sanitized WWW-Authenticate parameters — allow-listed keys only, never a credential. */
  authChallenge?: string;
};

/**
 * The diagnostic half of a 401, and ONLY the parts that are safe to keep.
 *
 * WHY THIS EXISTS. The first real Stage 1 attempt returned 401 from createConversation and this
 * function's earlier form returned immediately on 401 — reading `error.code` for 403 but not for
 * 401. Microsoft named the cause and we discarded it, so a production failure could only be
 * narrowed by reasoning rather than read. Two adjacent statuses handled asymmetrically is how a
 * diagnosis becomes unavailable exactly when it is needed.
 *
 * ALLOW-LIST, NOT DENY-LIST. Only these four keys are ever kept. `error` and `error_description`
 * say what was wrong; `realm` and `authorization_uri` say which directory Microsoft expected,
 * which is the open question about this bot's app type. A challenge never carries a bearer token,
 * but the allow-list means a future parameter cannot smuggle one into a log either. `claims` is
 * reduced to a presence flag because it can be large and is not needed to diagnose.
 */
const CHALLENGE_KEYS = ["error", "error_description", "realm", "authorization_uri"] as const;
const CHALLENGE_MAX = 300;

export function sanitizeAuthChallenge(header: string | null): string | undefined {
  const raw = (header ?? "").trim();
  if (!raw) return undefined;
  const scheme = raw.split(/[\s,]/)[0] ?? "";
  const parts: string[] = [];
  if (/^[A-Za-z]+$/.test(scheme)) parts.push(`scheme=${scheme}`);
  for (const key of CHALLENGE_KEYS) {
    const m = new RegExp(`\\b${key}="([^"]*)"`, "i").exec(raw);
    if (m?.[1]) parts.push(`${key}=${m[1].replace(/[\r\n]/g, " ").slice(0, 160)}`);
  }
  if (/\bclaims="/i.test(raw)) parts.push("claims=present");
  // A challenge we could not parse at all is reported as present rather than echoed verbatim:
  // echoing an unknown shape is exactly how something unexpected reaches a log.
  const out = parts.length ? parts.join("; ") : "present, unparsed";
  return out.slice(0, CHALLENGE_MAX);
}

/** Microsoft's `error.code` only. The rest of the body — including any prose — is dropped. */
async function microsoftCode(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { error?: { code?: unknown } };
    const code = body?.error?.code;
    return typeof code === "string" && code ? code.slice(0, 80) : undefined;
  } catch {
    // An unreadable body simply yields no code. It never changes the classification.
    return undefined;
  }
}

export type ConversationResult =
  | { ok: true; conversationId: string }
  | ({ ok: false } & ConnectorError);

export type SendResult = { ok: true } | ({ ok: false } & ConnectorError);

/**
 * Classify a Connector response WITHOUT keeping its body.
 *
 * A 403 is split in two because the difference decides what a human does next: an
 * installation-shaped refusal means someone must install the app for that person, while any
 * other 403 is a permission problem in the bot registration. Microsoft signals the first through
 * error codes such as `BotNotInConversationRoster` / `ConversationNotFound`, so the code is read
 * and the rest of the body discarded.
 */
async function classify(res: Response): Promise<ConnectorError> {
  // A 5xx is the only status that cannot rule out acceptance: the request reached Microsoft and
  // the failure may have happened after it was taken. Every 4xx below is a refusal to act.
  //
  // ★ `failure` and `ambiguous` are unchanged for every status. The diagnostic fields added here
  // are read by nobody who decides anything: release, retry and delivery_unknown all still turn
  // on `ambiguous` alone.
  if (res.status === 401) {
    return {
      failure: "unauthorized",
      ambiguous: false,
      microsoftCode: await microsoftCode(res),
      authChallenge: sanitizeAuthChallenge(res.headers.get("www-authenticate")),
    };
  }
  if (res.status === 429) return { failure: "throttled", ambiguous: false };
  if (res.status >= 500) return { failure: "upstream_error", ambiguous: true };
  if (res.status === 403) {
    const code = (await microsoftCode(res)) ?? "";
    return /notinconversation|conversationnotfound|botnotin|notfound/i.test(code)
      ? { failure: "not_installed", ambiguous: false, microsoftCode: code || undefined }
      : { failure: "forbidden", ambiguous: false, microsoftCode: code || undefined };
  }
  return { failure: "invalid_request", ambiguous: false, microsoftCode: await microsoftCode(res) };
}

/**
 * One structured line per refused Connector call.
 *
 * Carries the OPERATION, so the next real failure states which call was rejected instead of
 * being deduced from which database rows happen to exist. Nothing here is a URL, a body, a header
 * we sent, or anything derived from the message.
 */
function logConnectorFailure(operation: ConnectorOperation, status: number, err: ConnectorError) {
  console.error("[teams-proactive] connector failure", {
    operation,
    status,
    failure: err.failure,
    ambiguous: err.ambiguous,
    microsoft_code: err.microsoftCode ?? "none",
    auth_challenge: err.authChallenge ?? "none",
  });
}

const base = (serviceUrl: string) => serviceUrl.replace(/\/+$/, "");

/**
 * Create a 1:1 conversation with one person, or report why not.
 *
 * The caller reuses a stored conversation before calling this, so reaching here means BTY has
 * never had a thread with this person. Teams will create a SECOND thread if asked twice, which
 * is why the result is persisted by the caller the moment it succeeds.
 */
export async function createOneOnOneConversation(params: {
  token: string;
  appId: string;
  serviceUrl: string;
  tenantId: string;
  aadObjectId: string;
}): Promise<ConversationResult> {
  try {
    const res = await fetch(`${base(params.serviceUrl)}/v3/conversations`, {
      method: "POST",
      headers: { authorization: `Bearer ${params.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        bot: { id: botAddress(params.appId) },
        members: [{ id: params.aadObjectId }],
        channelData: { tenant: { id: params.tenantId } },
        isGroup: false,
      }),
      signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
    });
    if (!res.ok) {
      const err = await classify(res);
      logConnectorFailure("create_conversation", res.status, err);
      return { ok: false, ...err };
    }
    const body = (await res.json()) as { id?: unknown };
    if (typeof body.id !== "string" || !body.id.trim()) {
      console.error("[teams-proactive] createConversation returned no id");
      return { ok: false, failure: "invalid_request", ambiguous: false };
    }
    return { ok: true, conversationId: body.id.trim() };
  } catch {
    // A conversation may exist in Teams that we will never learn the id of. Ambiguous.
    console.error("[teams-proactive] connector failure", {
      operation: "create_conversation", status: 0, failure: "unreachable", ambiguous: true,
      microsoft_code: "none", auth_challenge: "none",
    });
    return { ok: false, failure: "unreachable", ambiguous: true };
  }
}

/**
 * Post exactly one message activity into an existing conversation.
 *
 * Success is the HTTP result and nothing else. The caller must not record a delivery on any
 * weaker signal — a person marked as told who was not told is worse than one told twice.
 */
export async function sendProactiveMessage(params: {
  token: string;
  serviceUrl: string;
  conversationId: string;
  text: string;
}): Promise<SendResult> {
  try {
    const res = await fetch(
      `${base(params.serviceUrl)}/v3/conversations/${encodeURIComponent(params.conversationId)}/activities`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${params.token}`, "content-type": "application/json" },
        body: JSON.stringify({ type: "message", textFormat: "markdown", text: params.text }),
        signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      const err = await classify(res);
      logConnectorFailure("send_activity", res.status, err);
      return { ok: false, ...err };
    }
    return { ok: true };
  } catch {
    // The POST had already begun. Teams may well have accepted the message and the response was
    // lost -- which is precisely the case that must NOT free the lease.
    console.error("[teams-proactive] connector failure", {
      operation: "send_activity", status: 0, failure: "unreachable", ambiguous: true,
      microsoft_code: "none", auth_challenge: "none",
    });
    return { ok: false, failure: "unreachable", ambiguous: true };
  }
}
