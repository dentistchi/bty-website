import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureActionCapture,
  listMyActionCaptures,
  setActionCaptureTriage,
} from "./ensureActionCapture.server";
import type { TeamsCaptureInput } from "@/domain/action-capture/captureSource";

/**
 * Triage as a WRITE, and what it is not allowed to disturb (Slice T2).
 *
 * The double below enforces the parts of the real schema this slice depends on: ownership and
 * eligibility live in the WHERE clause, and the biconditional CHECK is applied on write, so a
 * mistake that PostgreSQL would refuse is refused here too rather than passing in a mock and
 * failing on production.
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
  capture_reason: "explicit_save",
};

type Row = Record<string, unknown>;
type Store = { rows: Row[] };

function makeAdmin(store: Store) {
  const touched: string[] = [];
  const updatePayloads: Row[] = [];

  const from = vi.fn((table: string) => {
    touched.push(table);
    // Structural, not mocked-away: any other table is a hard failure, so "touches one table" is
    // proven by the code's behaviour rather than by our imagination.
    if (table !== "bty_action_captures") throw new Error(`FORBIDDEN TABLE ACCESS: ${table}`);

    const eqs: Row = {};


    const notNull: Record<string, boolean> = {};
    const isNull: string[] = [];
    let patch: Row | null = null;

    const matching = () =>
      store.rows.filter(
        (r) =>
          Object.entries(eqs).every(([k, v]) => r[k] === v) &&
          isNull.every((k) => r[k] === null || r[k] === undefined) &&
          Object.keys(notNull).every((k) => r[k] !== null && r[k] !== undefined),
      );

    const applyUpdate = () => {
      const hits = matching();
      for (const r of hits) {
        // The DB's biconditional CHECK, enforced here too.
        const next = { ...r, ...(patch as Row) };
        const choice = next.triage_choice ?? null;
        const at = next.triaged_at ?? null;
        const consistent = (choice === null && at === null) || (["soon", "later"].includes(String(choice)) && at !== null);
        if (!consistent) throw new Error("CHECK bty_action_captures_triage_pair_check violated");
        Object.assign(r, patch);
      }
      return hits;
    };

    const api: Row = {
      select: () => api,
      eq: (c: string, v: unknown) => ((eqs[c] = v), api),
      /*
        `not(col, "is", null)` — the Saved lane's explicit-intent filter (A1-INTENT). A capture
        that exists only as an announcement's source evidence carries `saved_at = null` and is not
        listed; the double applies the same predicate so the ordering assertions below still
        describe what a person actually sees.
      */
      not: (c: string, _op: string, v: unknown) => (v === null ? ((notNull[c] = true), api) : api),
      is: (c: string, v: unknown) => (v === null ? isNull.push(c) : null, api),
      order: () => Promise.resolve({ data: matching(), error: null }),
      maybeSingle: () =>
        Promise.resolve(
          patch
            ? { data: applyUpdate()[0] ?? null, error: null }
            : { data: matching()[0] ?? null, error: null },
        ),
      update: (p: Row) => {
        updatePayloads.push(p);
        patch = p;
        return api;
      },
      insert: (row: Row) => {
        const saved = { id: `cap-${store.rows.length + 1}`, captured_at: "2026-08-28T00:00:00Z", triage_choice: null, triaged_at: null, ...row };
        store.rows.push(saved);
        return { select: () => ({ single: () => Promise.resolve({ data: saved, error: null }) }) };
      },
    };
    return api;
  });

  return { admin: { from } as never, touched, updatePayloads };
}

let store: Store;
beforeEach(() => {
  store = { rows: [] };
  vi.clearAllMocks();
});

async function seed(admin: never, userId = USER_A, over: Partial<TeamsCaptureInput> = {}) {
  // These suites exercise the SAVE path; intent is required and stated rather than assumed.
  const r = await ensureActionCapture(admin, { userId, input: { ...input, ...over }, intent: "save" });
  if (!r.ok) throw new Error("seed failed");
  return r.capture;
}

describe("setActionCaptureTriage — the decision", () => {
  it("9+10. records soon, writing ONLY the two triage columns", async () => {
    const { admin, updatePayloads } = makeAdmin(store);
    const cap = await seed(admin);

    const res = await setActionCaptureTriage(admin, { userId: USER_A, captureId: cap.id, choice: "soon" });

    expect(res.ok && res.changed).toBe(true);
    expect(res.ok && res.capture.triageChoice).toBe("soon");
    expect(res.ok && res.capture.triagedAt).toBeTruthy();
    // The payload is the proof: two keys, and neither is provenance, status or promotion.
    expect(Object.keys(updatePayloads[0]).sort()).toEqual(["triage_choice", "triaged_at"]);
  });

  it("10. records later the same way", async () => {
    const { admin, updatePayloads } = makeAdmin(store);
    const cap = await seed(admin);
    const res = await setActionCaptureTriage(admin, { userId: USER_A, captureId: cap.id, choice: "later" });
    expect(res.ok && res.capture.triageChoice).toBe("later");
    expect(Object.keys(updatePayloads[0]).sort()).toEqual(["triage_choice", "triaged_at"]);
  });

  it("11. leaves every provenance field exactly as captured", async () => {
    const { admin } = makeAdmin(store);
    const cap = await seed(admin);
    const before = { ...(store.rows[0] as Row) };

    await setActionCaptureTriage(admin, { userId: USER_A, captureId: cap.id, choice: "soon" });

    const after = store.rows[0] as Row;
    for (const k of ["user_id", "source_type", "external_key", "preview_text", "source_url", "source_metadata", "captured_at", "status"]) {
      expect(after[k], `${k} must be immutable`).toEqual(before[k]);
    }
    expect(after.status).toBe("captured"); // triage is not a lifecycle transition
    expect(after.promoted_at ?? null).toBeNull();
    expect(after.promoted_action_contract_id ?? null).toBeNull();
  });

  it("8. cannot triage another user's capture, and says only NOT_FOUND", async () => {
    const { admin } = makeAdmin(store);
    const cap = await seed(admin, USER_A);

    const res = await setActionCaptureTriage(admin, { userId: USER_B, captureId: cap.id, choice: "soon" });

    // Identical to a genuinely missing row: existence must not leak.
    expect(res).toEqual({ ok: false, code: "not_found" });
    expect((store.rows[0] as Row).triage_choice).toBeNull();
    const missing = await setActionCaptureTriage(admin, { userId: USER_B, captureId: "no-such-id", choice: "soon" });
    expect(missing).toEqual({ ok: false, code: "not_found" });
  });

  it("12. a second decision is deterministic: the standing one is returned, unchanged", async () => {
    const { admin } = makeAdmin(store);
    const cap = await seed(admin);
    const first = await setActionCaptureTriage(admin, { userId: USER_A, captureId: cap.id, choice: "soon" });
    const firstAt = first.ok ? first.capture.triagedAt : null;

    const second = await setActionCaptureTriage(admin, { userId: USER_A, captureId: cap.id, choice: "later" });

    // V1 has no re-triage. The first decision stands, and the timestamp is NOT rewritten.
    expect(second.ok && second.changed).toBe(false);
    expect(second.ok && second.capture.triageChoice).toBe("soon");
    expect(second.ok && second.capture.triagedAt).toBe(firstAt);
    expect((store.rows[0] as Row).triage_choice).toBe("soon");
  });
});

describe("14-18. a repeat Teams save never disturbs a decision", () => {
  it("returns the existing row and preserves triage, provenance and captured_at", async () => {
    const { admin } = makeAdmin(store);
    const cap = await seed(admin);
    await setActionCaptureTriage(admin, { userId: USER_A, captureId: cap.id, choice: "later" });
    const before = { ...(store.rows[0] as Row) };

    const again = await ensureActionCapture(admin, { userId: USER_A, input, intent: "save" });

    expect(again.ok && again.created).toBe(false);
    expect(again.ok && again.capture.id).toBe(cap.id);
    expect(store.rows, "no second row").toHaveLength(1);
    // 15, 16, 17, 18 — every field, byte for byte.
    expect(store.rows[0]).toEqual(before);
    expect(again.ok && again.capture.triageChoice).toBe("later");
  });
});

describe("6. the saved lane's order", () => {
  it("is undecided first, then soon, then later — and never inferred from captured_at", async () => {
    const { admin } = makeAdmin(store);
    const a = await seed(admin, USER_A, { message_id: "M1" });
    const b = await seed(admin, USER_A, { message_id: "M2" });
    await seed(admin, USER_A, { message_id: "M3" });
    await setActionCaptureTriage(admin, { userId: USER_A, captureId: a.id, choice: "later" });
    await setActionCaptureTriage(admin, { userId: USER_A, captureId: b.id, choice: "soon" });

    const list = await listMyActionCaptures(admin, USER_A);

    expect(list.map((i) => i.triageChoice)).toEqual([null, "soon", "later"]);
  });
});

describe("29+30+31. triage cannot reach anything else", () => {
  it("touches exactly one table across seed, decide and re-read", async () => {
    const { admin, touched } = makeAdmin(store);
    const cap = await seed(admin);
    await setActionCaptureTriage(admin, { userId: USER_A, captureId: cap.id, choice: "soon" });
    await listMyActionCaptures(admin, USER_A);

    // Structural: the double throws on any other table, so this is the whole reachable surface.
    // No bty_action_contracts insert or update, no arena_*, no core_xp_ledger, no le_* log.
    expect([...new Set(touched)]).toEqual(["bty_action_captures"]);
  });
});
