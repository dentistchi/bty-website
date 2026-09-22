/**
 * DELIVERY ATTEMPT EVIDENCE. Slice Teams Delivery Diagnostics V1.
 *
 * The property: every stage outcome is recorded — success AND failure — and nothing sensitive is.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordDeliveryAttempt } from "./deliveryAttempt.server";

const TENANT = "10110d5c-bd30-467e-9912-e44e67777647";
const OID = "aaaaaaaa-0000-4000-8000-000000000001";

function makeAdmin(fail = false) {
  const rows: Record<string, unknown>[] = [];
  const from = () => ({
    insert: (r: Record<string, unknown>) => {
      if (!fail) rows.push(r);
      return Promise.resolve({ error: fail ? { code: "23514", message: "check violation" } : null });
    },
  });
  return { admin: { from } as unknown as SupabaseClient, rows };
}

const base = {
  eventId: "ev-1",
  ownerUserId: "owner-1",
  tenantId: TENANT,
  aadObjectId: OID,
};

beforeEach(() => vi.clearAllMocks());

describe("every outcome is recorded, not only the failures", () => {
  it.each([
    ["graph_validation", "eligible"],
    ["graph_validation", "not_eligible"],
    ["conversation_resolution", "not_installed"],
    ["conversation_resolution", "conversation_failed"],
    ["card_send", "delivered"],
    ["card_send", "send_failed"],
    ["card_send", "delivery_unknown"],
  ] as const)("%s / %s", async (stage, result) => {
    const { admin, rows } = makeAdmin();
    await recordDeliveryAttempt(admin, { ...base, stage, result });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ stage, result, event_id: "ev-1", tenant_id: TENANT, aad_object_id: OID });
  });
});

describe("★ the row holds evidence, never secrets", () => {
  it("records a short symbolic Microsoft code", async () => {
    const { admin, rows } = makeAdmin();
    await recordDeliveryAttempt(admin, {
      ...base, stage: "conversation_resolution", result: "not_installed",
      microsoftFailureCode: "BotNotInConversationRoster",
    });
    expect(rows[0]!.microsoft_failure_code).toBe("BotNotInConversationRoster");
  });

  it("★ REFUSES anything that looks like a message, header or payload", async () => {
    for (const code of [
      "403 Forbidden: the bot is not in the conversation roster",
      "Bearer realm=\"https://api.botframework.com\", error=\"invalid_token\"",
      '{"error":{"code":"Forbidden","message":"denied"}}',
      "x".repeat(200),
      "  ",
      null,
      undefined,
      42,
      {},
    ]) {
      const { admin, rows } = makeAdmin();
      await recordDeliveryAttempt(admin, { ...base, stage: "card_send", result: "send_failed", microsoftFailureCode: code });
      expect(rows[0]!.microsoft_failure_code, String(code)).toBeNull();
    }
  });

  it("never carries a token, an address, a serviceUrl or a conversation id", async () => {
    const { admin, rows } = makeAdmin();
    await recordDeliveryAttempt(admin, { ...base, stage: "card_send", result: "delivered", displayName: "Ari Kim" });
    const keys = Object.keys(rows[0]!).sort();
    expect(keys).toEqual([
      "aad_object_id", "display_name_snapshot", "event_id", "microsoft_failure_code",
      "owner_user_id_snapshot", "result", "stage", "tenant_id",
    ]);
    const s = JSON.stringify(rows[0]);
    expect(s).not.toMatch(/@|token|bearer|serviceUrl|smba|conversation_id/i);
  });
});

describe("★ a diagnostic write never becomes a delivery failure", () => {
  it("swallows a database error and resolves", async () => {
    const { admin, rows } = makeAdmin(true);
    await expect(
      recordDeliveryAttempt(admin, { ...base, stage: "card_send", result: "delivered" }),
    ).resolves.toBeUndefined();
    expect(rows).toHaveLength(0);
  });

  it("swallows a thrown client and resolves", async () => {
    const admin = { from: () => { throw new Error("down"); } } as unknown as SupabaseClient;
    await expect(
      recordDeliveryAttempt(admin, { ...base, stage: "graph_validation", result: "eligible" }),
    ).resolves.toBeUndefined();
  });
});
