/**
 * SENDING A TRAINING INTO TEAMS — authorization, eligibility and idempotency.
 * Slice Teams Chat-Native Text Training + Quiz V1.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const H = vi.hoisted(() => ({
  graphConfig: vi.fn(() => ({ tenantId: "10110d5c-bd30-467e-9912-e44e67777647", clientId: "c", clientSecret: "s" }) as { tenantId: string; clientId: string; clientSecret: string } | null),
  graphToken: vi.fn(async () => "graph-token" as string | null),
  eligibility: vi.fn(async (_t: string, oid: string) => ({ ok: true as const, eligible: true as const, displayName: `Name ${oid.slice(0, 4)}` }) as unknown),
  botToken: vi.fn<() => Promise<Record<string, unknown>>>(async () => ({ ok: true, token: "bot-token" })),
  sendCard: vi.fn<(p: unknown) => Promise<{ ok: boolean; failure?: string; ambiguous?: boolean }>>(async () => ({ ok: true })),
  resolveConversation: vi.fn<(p: unknown) => Promise<Record<string, unknown>>>(async () => ({ ok: true, serviceUrl: "https://smba.trafficmanager.net/amer/", conversationId: "conv-1", created: false })),
  guidance: vi.fn(async () => ({ version: 1, contentType: "written_guidance", materialText: "Escalate within 24 hours.", completionPrompt: null, sharedQuestion: null, completionEvidence: "quiz" })),
  tenantRoute: vi.fn(async () => "https://smba.trafficmanager.net/amer/" as string | null),
}));

vi.mock("@/lib/bty/microsoft/graphDirectory.server", () => ({
  graphConfigFromEnv: H.graphConfig,
  getGraphAppToken: H.graphToken,
  probeRecipientEligibility: H.eligibility,
}));
vi.mock("@/lib/bty/teams/botToken.server", () => ({ getBotFrameworkToken: H.botToken }));
vi.mock("@/lib/bty/teams/proactiveConversation.server", () => ({ sendProactiveCard: H.sendCard }));
vi.mock("@/lib/bty/teams/resolveTeamsConversation.server", () => ({ resolveTeamsConversation: H.resolveConversation }));
vi.mock("@/lib/bty/foundry/events/foundryGuidanceService", () => ({ readGuidanceContent: H.guidance }));
vi.mock("@/lib/bty/teams/tenantRoute.server", () => ({ readTenantRoute: H.tenantRoute }));

import { sendTrainingToTeams } from "./trainingDelivery.server";

const TENANT = "10110d5c-bd30-467e-9912-e44e67777647";
const OID_A = "aaaaaaaa-0000-4000-8000-000000000001";
const OID_B = "bbbbbbbb-0000-4000-8000-000000000002";

type Row = Record<string, unknown>;

function makeAdmin(over: { contentType?: string; owner?: string; quiz?: boolean; deliveries?: Row[] } = {}) {
  let n = 0;
  const tables: Record<string, Row[]> = {
    foundry_events: [{ id: "ev-1", owner_user_id: over.owner ?? "owner-1", title: "Morning Office Opening", status: "open", content_type: over.contentType ?? "written_guidance" }],
    foundry_event_quizzes: over.quiz === false ? [] : [{ event_id: "ev-1" }],
    foundry_teams_training_deliveries: over.deliveries ?? [],
  };
  function from(table: string) {
    const rows = (tables[table] ??= []);
    const st = { f: [] as { c: string; v: unknown }[], patch: null as Row | null };
    const match = () => rows.filter((r) => st.f.every((x) => r[x.c] === x.v));
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => { st.f.push({ c, v }); return q; },
      update: (p: Row) => { st.patch = p; return q; },
      insert: async (r: Row) => { rows.push(r); return { error: null }; },
      maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
      then: (onF: (v: { data: unknown; error: unknown }) => unknown) => {
        const hits = match();
        if (st.patch) hits.forEach((r) => Object.assign(r, st.patch));
        return Promise.resolve({ data: hits, error: null }).then(onF);
      },
    };
    return q;
  }
  const rpc = vi.fn(async (name: string, args: Row) => {
    expect(name).toBe("claim_foundry_teams_training_delivery");
    const event = tables.foundry_events.find((row) => row.id === args.p_event_id && row.owner_user_id === args.p_owner_user_id);
    if (!event) return { data: { state: "not_owner" }, error: null };
    if (event.status !== "open") return { data: { state: "event_closed" }, error: null };
    const rows = tables.foundry_teams_training_deliveries;
    const existing = rows.find((row) =>
      row.event_id === args.p_event_id && row.tenant_id === args.p_tenant_id && row.aad_object_id === args.p_aad_object_id,
    );
    if (existing?.delivery_status === "DELIVERED") return { data: { state: "already_sent" }, error: null };
    if (existing?.delivery_status === "PENDING") return { data: { state: "pending" }, error: null };
    const delivery = existing ?? { id: `del-${++n}` };
    Object.assign(delivery, {
      event_id: args.p_event_id, tenant_id: args.p_tenant_id, aad_object_id: args.p_aad_object_id,
      display_name_snapshot: args.p_display_name, delivery_status: "PENDING",
    });
    if (!existing) rows.push(delivery);
    return { data: { state: "claimed", deliveryId: delivery.id }, error: null };
  });
  return { admin: { from, rpc } as unknown as SupabaseClient, tables, rpc };
}

beforeEach(() => {
  process.env.TEAMS_BOT_TENANT_ID = TENANT;
  process.env.TEAMS_BOT_APP_ID = "bot-app";
  vi.clearAllMocks();
  H.graphConfig.mockReturnValue({ tenantId: TENANT, clientId: "c", clientSecret: "s" });
  H.graphToken.mockResolvedValue("graph-token");
  H.eligibility.mockImplementation(async (_t: string, oid: string) => ({ ok: true, eligible: true, displayName: `Name ${oid.slice(0, 4)}` }));
  H.botToken.mockResolvedValue({ ok: true, token: "bot-token" });
  H.sendCard.mockResolvedValue({ ok: true });
  H.resolveConversation.mockResolvedValue({ ok: true, serviceUrl: "https://smba.trafficmanager.net/amer/", conversationId: "conv-1", created: false });
  H.tenantRoute.mockResolvedValue("https://smba.trafficmanager.net/amer/");
});

const send = (admin: SupabaseClient, ids: string[], owner = "owner-1") =>
  sendTrainingToTeams(admin, { ownerUserId: owner, eventId: "ev-1", aadObjectIds: ids });

describe("★ the Host must own the training", () => {
  it("a non-owner is refused, and nothing is sent", async () => {
    const { admin, tables } = makeAdmin();
    expect(await send(admin, [OID_A], "someone-else")).toEqual({ ok: false, reason: "not_owner" });
    expect(H.sendCard).not.toHaveBeenCalled();
    expect(tables.foundry_teams_training_deliveries).toHaveLength(0);
  });

  it("rejects a stale Host request for a closed event before contacting Teams", async () => {
    const { admin, tables, rpc } = makeAdmin();
    tables.foundry_events[0]!.status = "closed";
    expect(await send(admin, [OID_A])).toEqual({ ok: false, reason: "event_closed" });
    expect(rpc).not.toHaveBeenCalled();
    expect(H.eligibility).not.toHaveBeenCalled();
    expect(H.sendCard).not.toHaveBeenCalled();
  });

  it("does not send if the event closes during conversation resolution", async () => {
    const { admin, tables, rpc } = makeAdmin();
    H.resolveConversation.mockImplementationOnce(async () => {
      tables.foundry_events[0]!.status = "closed";
      return { ok: true, serviceUrl: "https://smba.trafficmanager.net/amer/", conversationId: "conv-1" };
    });
    const result = await send(admin, [OID_A]);
    expect(result.ok && result.outcomes[0]).toMatchObject({ status: "undeliverable", reason: "event_closed" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(H.sendCard).not.toHaveBeenCalled();
    expect(tables.foundry_teams_training_deliveries).toHaveLength(0);
  });
});

describe("★ V1 is TEXT + QUIZ", () => {
  it.each([["youtube"], ["document"]])("%s is refused calmly rather than half-delivered", async (contentType) => {
    const { admin } = makeAdmin({ contentType });
    expect(await send(admin, [OID_A])).toEqual({ ok: false, reason: "unsupported_material" });
    expect(H.sendCard).not.toHaveBeenCalled();
  });

  it("a text training with no quiz is refused", async () => {
    const { admin } = makeAdmin({ quiz: false });
    expect(await send(admin, [OID_A])).toEqual({ ok: false, reason: "no_quiz" });
  });
});

describe("★ recipients are validated against Graph before anything is created", () => {
  it("sends to an enabled member", async () => {
    const { admin, tables } = makeAdmin();
    const res = await send(admin, [OID_A]);
    expect(res.ok && res.outcomes[0]).toMatchObject({ status: "sent", aadObjectId: OID_A });
    expect(H.eligibility).toHaveBeenCalledWith("graph-token", OID_A);
    expect(tables.foundry_teams_training_deliveries[0]).toMatchObject({
      tenant_id: TENANT, aad_object_id: OID_A, delivery_status: "DELIVERED",
    });
  });

  it.each([
    ["disabled", { ok: true, eligible: false, reason: "disabled" }],
    ["a guest", { ok: true, eligible: false, reason: "not_member" }],
    ["absent", { ok: false, reason: "not_found" }],
  ])("%s is NOT sent and NO row is written", async (_label, verdict) => {
    H.eligibility.mockResolvedValue(verdict);
    const { admin, tables } = makeAdmin();
    const res = await send(admin, [OID_A]);
    expect(res.ok && res.outcomes[0]).toMatchObject({ status: "undeliverable", reason: "not_eligible" });
    expect(H.sendCard).not.toHaveBeenCalled();
    expect(tables.foundry_teams_training_deliveries).toHaveLength(0);
  });

  it("an unreachable Graph is INDETERMINATE, not a refusal of the person", async () => {
    H.eligibility.mockResolvedValue({ ok: false, reason: "network" });
    const { admin } = makeAdmin();
    const res = await send(admin, [OID_A]);
    expect(res.ok && res.outcomes[0]).toMatchObject({ status: "undeliverable", reason: "unknown" });
  });

  it("an UNCONFIGURED Graph refuses the whole send rather than skipping validation", async () => {
    H.graphConfig.mockReturnValue(null);
    const { admin, tables } = makeAdmin();
    expect(await send(admin, [OID_A])).toEqual({ ok: false, reason: "graph_unavailable" });
    expect(tables.foundry_teams_training_deliveries).toHaveLength(0);
  });

  it("a Graph credential for a DIFFERENT tenant is refused", async () => {
    H.graphConfig.mockReturnValue({ tenantId: "99999999-9999-4999-8999-999999999999", clientId: "c", clientSecret: "s" });
    const { admin } = makeAdmin();
    expect(await send(admin, [OID_A])).toEqual({ ok: false, reason: "tenant_not_configured" });
  });

  it("a malformed object id never reaches Graph", async () => {
    const { admin } = makeAdmin();
    const res = await send(admin, ["not-a-guid", "", "../../admin"]);
    expect(res.ok && res.outcomes).toEqual([]);
    expect(H.eligibility).not.toHaveBeenCalled();
  });
});

describe("★ routing is only what a verified activity taught us", () => {
  it("no tenant route means no send — no endpoint is guessed", async () => {
    H.tenantRoute.mockResolvedValue(null);
    const { admin, tables } = makeAdmin();
    expect(await send(admin, [OID_A])).toEqual({ ok: false, reason: "tenant_not_configured" });
    expect(tables.foundry_teams_training_deliveries).toHaveLength(0);
  });
});

describe("★ idempotency — a second press reports, it does not re-message", () => {
  it("an already-DELIVERED recipient is reported and not sent again", async () => {
    const { admin } = makeAdmin({
      deliveries: [{ id: "del-x", event_id: "ev-1", tenant_id: TENANT, aad_object_id: OID_A, delivery_status: "DELIVERED" }],
    });
    const res = await send(admin, [OID_A]);
    expect(res.ok && res.outcomes[0]).toMatchObject({ status: "already_sent" });
    expect(H.sendCard).not.toHaveBeenCalled();
  });

  it("duplicate ids in one request are collapsed", async () => {
    const { admin, tables } = makeAdmin();
    const res = await send(admin, [OID_A, OID_A, OID_A.toUpperCase()]);
    expect(res.ok && res.outcomes).toHaveLength(1);
    expect(tables.foundry_teams_training_deliveries).toHaveLength(1);
    expect(H.sendCard).toHaveBeenCalledTimes(1);
  });

  it("sends once when two concurrent requests race for the same delivery", async () => {
    const { admin, tables, rpc } = makeAdmin();
    const results = await Promise.all([send(admin, [OID_A]), send(admin, [OID_A])]);
    const outcomes = results.flatMap((result) => result.ok ? result.outcomes : []);
    expect(outcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "sent" }),
      expect.objectContaining({ status: "undeliverable", reason: "unknown" }),
    ]));
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(H.sendCard).toHaveBeenCalledTimes(1);
    expect(tables.foundry_teams_training_deliveries).toHaveLength(1);
  });
});

describe("delivery honesty", () => {
  it("the app not being installed is named, so a Host can act on it", async () => {
    H.resolveConversation.mockResolvedValue({ ok: false, reason: "not_installed" });
    const { admin } = makeAdmin();
    const res = await send(admin, [OID_A]);
    expect(res.ok && res.outcomes[0]).toMatchObject({ status: "undeliverable", reason: "not_installed", displayName: "Name aaaa" });
    expect(H.sendCard).not.toHaveBeenCalled();
  });

  it("★ an AMBIGUOUS send is never claimed as delivered", async () => {
    H.sendCard.mockResolvedValue({ ok: false, failure: "unreachable", ambiguous: true });
    const { admin, tables } = makeAdmin();
    const res = await send(admin, [OID_A]);
    expect(res.ok && res.outcomes[0]).toMatchObject({ status: "undeliverable", reason: "unknown" });
    expect(tables.foundry_teams_training_deliveries[0]!.delivery_status).toBe("PENDING");
    expect(tables.foundry_teams_training_deliveries[0]!.delivered_at ?? null).toBeNull();
    H.sendCard.mockResolvedValue({ ok: true });
    const retry = await send(admin, [OID_A]);
    expect(retry.ok && retry.outcomes[0]).toMatchObject({ status: "undeliverable", reason: "unknown" });
    expect(H.sendCard).toHaveBeenCalledTimes(1);
  });

  it("a proven send failure marks the row undeliverable", async () => {
    H.sendCard.mockResolvedValue({ ok: false, failure: "invalid_request", ambiguous: false });
    const { admin, tables } = makeAdmin();
    await send(admin, [OID_A]);
    expect(tables.foundry_teams_training_deliveries[0]!.delivery_status).toBe("UNDELIVERABLE");
    H.sendCard.mockResolvedValue({ ok: true });
    const retry = await send(admin, [OID_A]);
    expect(retry.ok && retry.outcomes[0]).toMatchObject({ status: "sent" });
    expect(tables.foundry_teams_training_deliveries).toHaveLength(1);
    expect(tables.foundry_teams_training_deliveries[0]!.delivery_status).toBe("DELIVERED");
    expect(H.sendCard).toHaveBeenCalledTimes(2);
  });

  it("a mixed selection reports each person truthfully", async () => {
    H.eligibility.mockImplementation(async (_t: string, oid: string) =>
      oid === OID_B ? { ok: true, eligible: false, reason: "disabled" } : { ok: true, eligible: true, displayName: "Ari" },
    );
    const { admin } = makeAdmin();
    const res = await send(admin, [OID_A, OID_B]);
    expect(res.ok && res.outcomes.map((o) => o.status)).toEqual(["sent", "undeliverable"]);
  });
});
