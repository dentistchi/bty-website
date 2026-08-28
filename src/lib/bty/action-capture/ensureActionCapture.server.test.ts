import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureActionCapture, listMyActionCaptures } from "./ensureActionCapture.server";
import type { TeamsCaptureInput } from "@/domain/action-capture/captureSource";

/**
 * Action Capture producer — idempotency, ownership, and the CAPTURE != COMMITMENT boundary.
 *
 * The isolation assertions here are STRUCTURAL: the fake records every table the code touches, so
 * "writes only bty_action_captures" is proven by the table log rather than by mocking away Arena,
 * Foundry, XP and the review queue and hoping none of them were called.
 */

const USER_A = "user-a";
const USER_B = "user-b";

const input: TeamsCaptureInput = {
  provider: "teams",
  tenant_id: "T1",
  conversation_id: "C1",
  message_id: "M1",
  preview_text: "Can you confirm the vendor quote?",
  source_url: "https://teams.microsoft.com/l/message/1",
  sender_display: "Ana",
};

type Store = { rows: Record<string, unknown>[] };

/**
 * In-memory Supabase double that ENFORCES the real unique constraint
 * (user_id, source_type, external_key) and raises 23505 exactly as PostgreSQL would.
 */
function makeAdmin(store: Store) {
  const touched: string[] = [];
  const inserts: Record<string, unknown>[] = [];

  const from = vi.fn((table: string) => {
    touched.push(table);
    if (table !== "bty_action_captures") {
      throw new Error(`FORBIDDEN TABLE ACCESS: ${table}`);
    }
    const filters: Record<string, unknown> = {};
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return api;
      },
      order: () => Promise.resolve({ data: matching(), error: null }),
      maybeSingle: () => Promise.resolve({ data: matching()[0] ?? null, error: null }),
      insert: (row: Record<string, unknown>) => {
        inserts.push(row);
        const clash = store.rows.some(
          (r) =>
            r.user_id === row.user_id &&
            r.source_type === row.source_type &&
            r.external_key === row.external_key,
        );
        if (clash) {
          return { select: () => ({ single: () => Promise.resolve({ data: null, error: { code: "23505" } }) }) };
        }
        const saved = { id: `cap-${store.rows.length + 1}`, captured_at: "2026-08-28T00:00:00Z", ...row };
        store.rows.push(saved);
        return { select: () => ({ single: () => Promise.resolve({ data: saved, error: null }) }) };
      },
    };
    function matching() {
      return store.rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
    }
    return api;
  });

  return { admin: { from } as never, touched, inserts, store };
}

let store: Store;
beforeEach(() => {
  store = { rows: [] };
  vi.clearAllMocks();
});

describe("ensureActionCapture — idempotency", () => {
  it("1+2+3. first save creates exactly one row; the identical save returns the SAME id and adds nothing", async () => {
    const { admin } = makeAdmin(store);
    const first = await ensureActionCapture(admin, { userId: USER_A, input });
    expect(first.ok && first.created).toBe(true);
    expect(store.rows).toHaveLength(1);

    const second = await ensureActionCapture(admin, { userId: USER_A, input });
    expect(second.ok && second.created).toBe(false);
    expect(first.ok && second.ok && first.capture.id === second.capture.id).toBe(true);
    expect(store.rows, "no second row").toHaveLength(1);
  });

  it("4. the same message saved by ANOTHER user is an independent capture", async () => {
    const { admin } = makeAdmin(store);
    await ensureActionCapture(admin, { userId: USER_A, input });
    const b = await ensureActionCapture(admin, { userId: USER_B, input });
    expect(b.ok && b.created).toBe(true);
    expect(store.rows).toHaveLength(2);
    expect(store.rows.map((r) => r.user_id).sort()).toEqual([USER_A, USER_B]);
  });

  it("5. the same user saving a DIFFERENT message creates a second capture", async () => {
    const { admin } = makeAdmin(store);
    await ensureActionCapture(admin, { userId: USER_A, input });
    const second = await ensureActionCapture(admin, { userId: USER_A, input: { ...input, message_id: "M2" } });
    expect(second.ok && second.created).toBe(true);
    expect(store.rows).toHaveLength(2);
  });

  it("6+7. re-saving with a CHANGED preview neither adds a row nor rewrites the original provenance", async () => {
    const { admin } = makeAdmin(store);
    await ensureActionCapture(admin, { userId: USER_A, input });
    const before = JSON.parse(JSON.stringify(store.rows[0]));

    const again = await ensureActionCapture(admin, {
      userId: USER_A,
      input: { ...input, preview_text: "REWRITTEN", sender_display: "Someone Else", source_url: "https://evil.example" },
    });

    expect(again.ok && again.created).toBe(false);
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0], "a repeated save is not permission to rewrite history").toEqual(before);
  });

  it("survives a concurrent writer: a 23505 re-reads the winner instead of failing", async () => {
    const { admin } = makeAdmin(store);
    // Simulate the row appearing between our existence check and our insert.
    const original = (admin as unknown as { from: ReturnType<typeof vi.fn> }).from;
    let firstLook = true;
    (admin as unknown as { from: ReturnType<typeof vi.fn> }).from = vi.fn((t: string) => {
      const api = original(t);
      if (firstLook) {
        firstLook = false;
        const raced = { ...api, maybeSingle: () => Promise.resolve({ data: null, error: null }) };
        store.rows.push({
          id: "cap-race",
          user_id: USER_A,
          source_type: "teams_message",
          external_key: "teams:T1:C1:M1",
          status: "captured",
          captured_at: "2026-08-28T00:00:00Z",
        });
        return raced;
      }
      return api;
    }) as never;

    const r = await ensureActionCapture(admin, { userId: USER_A, input });
    expect(r.ok && r.created).toBe(false);
    expect(r.ok && r.capture.id).toBe("cap-race");
    expect(store.rows).toHaveLength(1);
  });
});

describe("ensureActionCapture — server-owned fields", () => {
  it("ownership comes from the argument; a body-supplied user_id can never reach the insert", async () => {
    const { admin, inserts } = makeAdmin(store);
    await ensureActionCapture(admin, {
      userId: USER_A,
      input: { ...input, user_id: USER_B, external_key: "teams:HACK", source_type: "spoofed" } as never,
    });
    expect(inserts[0].user_id).toBe(USER_A);
    expect(inserts[0].external_key).toBe("teams:T1:C1:M1");
    expect(inserts[0].source_type).toBe("teams_message");
  });

  it("always writes status='captured' and NEVER the promotion columns", async () => {
    const { admin, inserts } = makeAdmin(store);
    await ensureActionCapture(admin, { userId: USER_A, input });
    expect(inserts[0].status).toBe("captured");
    expect(inserts[0]).not.toHaveProperty("promoted_at");
    expect(inserts[0]).not.toHaveProperty("promoted_action_contract_id");
  });

  it("a blank user id is refused before any write", async () => {
    const { admin, inserts } = makeAdmin(store);
    const r = await ensureActionCapture(admin, { userId: "   ", input });
    expect(r.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it("an unopenable source_url is dropped, not stored", async () => {
    const { admin, inserts } = makeAdmin(store);
    await ensureActionCapture(admin, { userId: USER_A, input: { ...input, source_url: "javascript:alert(1)" } });
    expect(inserts[0].source_url).toBe(null);
  });
});

describe("CAPTURE != COMMITMENT — structural isolation", () => {
  it("the capture path touches bty_action_captures and NOTHING else", async () => {
    const { admin, touched } = makeAdmin(store);
    await ensureActionCapture(admin, { userId: USER_A, input });
    expect([...new Set(touched)]).toEqual(["bty_action_captures"]);
  });

  it.each([
    "bty_action_contracts",
    "arena_runs",
    "core_xp_ledger",
    "le_verification_log",
    "le_activation_log",
    "foundry_event_training_progress",
    "foundry_participant_followups",
    "foundry_participant_apply_windows",
    "bty_action_review_decision_audit",
  ])("never writes %s", async (forbidden) => {
    const { admin, touched } = makeAdmin(store);
    await ensureActionCapture(admin, { userId: USER_A, input });
    expect(touched).not.toContain(forbidden);
  });

  it("the stored row carries no commitment field of any kind", async () => {
    const { admin, inserts } = makeAdmin(store);
    await ensureActionCapture(admin, { userId: USER_A, input });
    for (const f of [
      "deadline_at", "expires_at", "due_at", "priority", "category", "tags", "weight", "mode",
      "le_activation_type", "verification_type", "verification_mode", "verification_tier",
      "pattern_family", "run_id", "organization_id", "chosen_at", "required",
    ]) {
      expect(inserts[0], `capture must not carry ${f}`).not.toHaveProperty(f);
    }
  });
});

describe("listMyActionCaptures — owner-scoped active list", () => {
  it("returns only this user's status='captured' rows", async () => {
    store.rows = [
      { id: "1", user_id: USER_A, status: "captured", source_type: "teams_message" },
      { id: "2", user_id: USER_A, status: "promoted", source_type: "teams_message" },
      { id: "3", user_id: USER_A, status: "dismissed", source_type: "teams_message" },
      { id: "4", user_id: USER_B, status: "captured", source_type: "teams_message" },
    ];
    const { admin } = makeAdmin(store);
    const out = await listMyActionCaptures(admin, USER_A);
    expect(out.map((c) => c.id)).toEqual(["1"]);
  });

  it("a blank user id returns nothing rather than everything", async () => {
    store.rows = [{ id: "1", user_id: USER_A, status: "captured" }];
    const { admin } = makeAdmin(store);
    expect(await listMyActionCaptures(admin, "")).toEqual([]);
  });
});
