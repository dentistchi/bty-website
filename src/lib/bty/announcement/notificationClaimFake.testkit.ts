/**
 * An in-memory stand-in for the five claim RPCs, faithful to
 * `20260909000000_bty_notification_delivery_claim_v1.sql`.
 *
 * WHY THIS EXISTS RATHER THAN MORE MOCKS. The defect being repaired is a RACE: two requests that
 * each pass their own check and then both send. A mock that returns a fixed answer per call cannot
 * express it — only shared mutable state can. Each handler below performs its read and its write
 * with no `await` in between, which is exactly what `for update` buys in the real function: the
 * decision and the mutation cannot be interleaved by another caller.
 *
 * It is a test double, so it is deliberately narrow: no ownership join (the tests that care drive
 * `result` directly), no announcement table beyond the fields `begin` returns.
 */

export type FakeRecipient = {
  id: string;
  tenantId: string;
  aadObjectId: string;
  serviceUrl: string;
  hostFraming: string;
  notifiedAt: number | null;
  claimToken: string | null;
  claimExpiresAt: number | null;
  sendStartedAt: number | null;
};

export const TTL_MS = 120_000;

export function makeRecipient(over: Partial<FakeRecipient> = {}): FakeRecipient {
  return {
    id: "r1",
    tenantId: "10110d5c-bd30-467e-9912-e44e67777647",
    aadObjectId: "f5767307-f693-4f8c-8e6c-5fb8a256b895",
    serviceUrl: "https://smba.example.net/amer/tenant/",
    hostFraming: "Please read this before Friday.",
    notifiedAt: null,
    claimToken: null,
    claimExpiresAt: null,
    sendStartedAt: null,
    ...over,
  };
}

/** A confirmed reference is a PAIR. Storing it as one object is the point. */
export type ConfirmedRef = { serviceUrl: string; conversationId: string };
export type CreationClaim = { token: string; expiresAt: number; createStartedAt: number | null; serviceUrl: string };

export function createClaimFake(recipients: FakeRecipient[]) {
  /** CONFIRMED REALITY. Keyed exactly as the real primary key (tenant_id, aad_object_id). */
  const convRefs = new Map<string, ConfirmedRef>();
  /** TEMPORARY COORDINATION. Same key, deliberately a different map. */
  const creationClaims = new Map<string, CreationClaim>();
  let now = Date.now();
  let tokenSeq = 0;
  const find = (id: string) => recipients.find((r) => r.id === id);
  const key = (t: string, a: string) => `${t}|${a}`;

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const r = find(String(args.p_recipient_id ?? ""));
    const wrap = (o: unknown) => ({ data: [o], error: null });

    if (fn === "bty_begin_recipient_notification") {
      const none = { claim_token: null, tenant_id: null, aad_object_id: null, service_url: null, host_framing: null, conversation_id: null };
      if (!r) return wrap({ result: "not_found", ...none });
      if (r.notifiedAt !== null) return wrap({ result: "already_notified", ...none });
      if (!r.serviceUrl) return wrap({ result: "no_service_url", ...none });
      if (r.claimToken !== null && (r.claimExpiresAt ?? 0) > now) return wrap({ result: "in_progress", ...none });
      // An expired lease whose owner had already begun sending. Never reclaimable.
      if (r.claimToken !== null && r.sendStartedAt !== null) return wrap({ result: "delivery_unknown", ...none });
      const t = `claim-${++tokenSeq}`;
      r.claimToken = t;
      r.claimExpiresAt = now + TTL_MS;
      r.sendStartedAt = null;
      // THE PAIR: both halves from the confirmed reference, or neither.
      const ref = convRefs.get(key(r.tenantId, r.aadObjectId));
      return wrap({
        result: "ok", claim_token: t,
        tenant_id: r.tenantId, aad_object_id: r.aadObjectId,
        service_url: ref ? ref.serviceUrl : r.serviceUrl,
        host_framing: r.hostFraming,
        conversation_id: ref ? ref.conversationId : null,
      });
    }

    if (fn === "bty_mark_recipient_notification_sending") {
      if (!r) return wrap({ result: "not_found" });
      if (r.notifiedAt !== null) return wrap({ result: "already_notified" });
      if (r.claimToken === null || r.claimToken !== args.p_claim_token) return wrap({ result: "claim_mismatch" });
      if ((r.claimExpiresAt ?? 0) <= now) return wrap({ result: "claim_expired" });
      if (r.sendStartedAt !== null) return wrap({ result: "already_sending" });
      r.sendStartedAt = now;
      return wrap({ result: "sending" });
    }

    if (fn === "bty_confirm_recipient_notification") {
      if (!r) return wrap({ result: "not_found", notified_at: null });
      if (r.notifiedAt !== null) return wrap({ result: "already_notified", notified_at: r.notifiedAt });
      if (r.claimToken === null || r.claimToken !== args.p_claim_token) return wrap({ result: "claim_mismatch", notified_at: null });
      if (r.sendStartedAt === null) return wrap({ result: "send_not_started", notified_at: null });
      r.notifiedAt = now;
      r.claimToken = null;
      r.claimExpiresAt = null;
      r.sendStartedAt = null;
      return wrap({ result: "notified", notified_at: r.notifiedAt });
    }

    if (fn === "bty_release_recipient_notification_claim") {
      if (!r) return wrap({ result: "not_found" });
      if (r.notifiedAt !== null) return wrap({ result: "already_notified" });
      if (r.claimToken === null || r.claimToken !== args.p_claim_token) return wrap({ result: "claim_mismatch" });
      r.claimToken = null;
      r.claimExpiresAt = null;
      r.sendStartedAt = null;
      return wrap({ result: "released" });
    }

    // ---- conversation creation lease, keyed on the PERSON ----
    const ck = key(String(args.p_tenant_id ?? ""), String(args.p_aad_object_id ?? ""));

    if (fn === "bty_begin_teams_conversation_creation") {
      const ref = convRefs.get(ck);
      if (ref) return wrap({ result: "already_exists", claim_token: null, service_url: ref.serviceUrl, conversation_id: ref.conversationId });
      const existing = creationClaims.get(ck);
      if (existing) {
        if (existing.expiresAt > now) return wrap({ result: "in_progress", claim_token: null, service_url: null, conversation_id: null });
        if (existing.createStartedAt !== null)
          return wrap({ result: "conversation_creation_unknown", claim_token: null, service_url: null, conversation_id: null });
      }
      const t = `conv-claim-${++tokenSeq}`;
      creationClaims.set(ck, { token: t, expiresAt: now + TTL_MS, createStartedAt: null, serviceUrl: String(args.p_service_url) });
      return wrap({ result: "ok", claim_token: t, service_url: String(args.p_service_url), conversation_id: null });
    }

    if (fn === "bty_mark_teams_conversation_creating") {
      const c = creationClaims.get(ck);
      if (!c) return wrap({ result: "claim_mismatch", service_url: null, conversation_id: null });
      const ref = convRefs.get(ck);
      if (ref) return wrap({ result: "already_exists", service_url: ref.serviceUrl, conversation_id: ref.conversationId });
      if (c.token !== args.p_claim_token) return wrap({ result: "claim_mismatch", service_url: null, conversation_id: null });
      if (c.expiresAt <= now) return wrap({ result: "claim_expired", service_url: null, conversation_id: null });
      if (c.createStartedAt !== null) return wrap({ result: "already_creating", service_url: null, conversation_id: null });
      c.createStartedAt = now;
      return wrap({ result: "creating", service_url: null, conversation_id: null });
    }

    if (fn === "bty_confirm_teams_conversation_created") {
      const url = String(args.p_service_url ?? "");
      const conv = String(args.p_conversation_id ?? "");
      if (!url || !conv) return wrap({ result: "invalid_conversation", service_url: null, conversation_id: null });
      const ref = convRefs.get(ck);
      // A confirmed reality is never overwritten, not even by a valid-looking token.
      if (ref) return wrap({ result: "already_exists", service_url: ref.serviceUrl, conversation_id: ref.conversationId });
      const c = creationClaims.get(ck);
      if (!c || c.token !== args.p_claim_token) return wrap({ result: "claim_mismatch", service_url: null, conversation_id: null });
      if (c.createStartedAt === null) return wrap({ result: "create_not_started", service_url: null, conversation_id: null });
      convRefs.set(ck, { serviceUrl: url, conversationId: conv });
      creationClaims.delete(ck);
      return wrap({ result: "created", service_url: url, conversation_id: conv });
    }

    if (fn === "bty_release_teams_conversation_creation_claim") {
      const c = creationClaims.get(ck);
      if (!c) return wrap({ result: "not_found" });
      if (c.token !== args.p_claim_token) return wrap({ result: "claim_mismatch" });
      creationClaims.delete(ck);
      return wrap({ result: "released" });
    }

    throw new Error(`unexpected rpc ${fn}`);
  };

  return {
    admin: { rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args) } as never,
    convRefs,
    creationClaims,
    /** Move the clock past a lease without waiting two real minutes. */
    advance: (ms: number) => { now += ms; },
    seedConversation: (t: string, a: string, ref: ConfirmedRef) => convRefs.set(key(t, a), ref),
  };
}
