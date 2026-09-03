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

export type ConnectorError = {
  failure: ConnectorFailure;
  /** true when successful delivery cannot be ruled out. NEVER auto-retry these. */
  ambiguous: boolean;
};

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
  if (res.status === 401) return { failure: "unauthorized", ambiguous: false };
  if (res.status === 429) return { failure: "throttled", ambiguous: false };
  if (res.status >= 500) return { failure: "upstream_error", ambiguous: true };
  if (res.status === 403) {
    let code = "";
    try {
      const body = (await res.json()) as { error?: { code?: unknown } };
      code = typeof body?.error?.code === "string" ? body.error.code : "";
    } catch {
      // A 403 with an unreadable body stays the generic one rather than being upgraded.
    }
    return /notinconversation|conversationnotfound|botnotin|notfound/i.test(code)
      ? { failure: "not_installed", ambiguous: false }
      : { failure: "forbidden", ambiguous: false };
  }
  return { failure: "invalid_request", ambiguous: false };
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
      console.error("[teams-proactive] createConversation refused", { status: res.status, ...err });
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
    console.error("[teams-proactive] createConversation unreachable");
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
      console.error("[teams-proactive] send refused", { status: res.status, ...err });
      return { ok: false, ...err };
    }
    return { ok: true };
  } catch {
    // The POST had already begun. Teams may well have accepted the message and the response was
    // lost -- which is precisely the case that must NOT free the lease.
    console.error("[teams-proactive] send outcome unknown");
    return { ok: false, failure: "unreachable", ambiguous: true };
  }
}
