/**
 * 안2-A: My Page Action Hub surface must include canonical `submitted` contracts.
 *
 * Root cause (fixed here): the awaiting query filtered `status='approved'` only,
 * but submit-validation's canonical path leaves the contract at `status='submitted'`
 * + validation_approved_at set + verified_at null. The submitted contract matched
 * neither the awaiting nor the terminal query → invisible → an older verified
 * contract surfaced as "Execution recorded" while the current one was still awaiting.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchAwaitingVerificationContractsForMyPage,
  fetchOpenActionContractForMyPage,
} from "./openActionContractForMyPage";

type QueryRec = { calls: Array<[string, unknown[]]>; status?: string; statusIn?: string[] };
type Resolve = (rec: QueryRec) => { data: unknown; error: unknown };

function makeSupabase(resolve: Resolve): { client: SupabaseClient; queries: QueryRec[] } {
  const queries: QueryRec[] = [];
  function builder() {
    const rec: QueryRec = { calls: [] };
    queries.push(rec);
    const b: Record<string, unknown> = {};
    const track = (name: string) => (...args: unknown[]) => {
      rec.calls.push([name, args]);
      if (name === "eq" && args[0] === "status") rec.status = String(args[1]);
      if (name === "in" && args[0] === "status") rec.statusIn = args[1] as string[];
      return b;
    };
    Object.assign(b, {
      select: track("select"),
      eq: track("eq"),
      in: track("in"),
      not: track("not"),
      is: track("is"),
      order: track("order"),
      limit: track("limit"),
      update: track("update"),
      maybeSingle: () => Promise.resolve(resolve(rec)),
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(resolve(rec)).then(onF, onR),
    });
    return b;
  }
  const client = { from: (_table: string) => builder() } as unknown as SupabaseClient;
  return { client, queries };
}

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

describe("fetchOpenActionContractForMyPage — awaiting surface (안2-A)", () => {
  it("surfaces a canonical submitted contract as action_awaiting_verification (wins over older terminal verified)", async () => {
    const submittedRow = {
      id: "await-1",
      contract_description: "Run the 1:1",
      deadline_at: FUTURE,
      verification_mode: "qr",
      status: "submitted",
      session_id: "run-await",
      required: false,
      validation_approved_at: "2026-05-29T00:00:00.000Z",
      verified_at: null,
    };
    const olderVerified = {
      id: "term-old",
      contract_description: "old done",
      deadline_at: FUTURE,
      verification_mode: "qr",
      status: "approved",
      session_id: "run-old",
      completion_method: "qr",
      completed_at: "2026-05-28T00:00:00.000Z",
      verified_at: "2026-05-28T00:00:00.000Z",
      validation_approved_at: "2026-05-28T00:00:00.000Z",
    };
    const { client } = makeSupabase((rec) => {
      if (rec.status === "pending") return { data: null, error: null };
      if (rec.statusIn?.includes("submitted")) return { data: submittedRow, error: null };
      if (rec.statusIn?.includes("completed")) return { data: [olderVerified], error: null };
      return { data: null, error: null };
    });

    const result = await fetchOpenActionContractForMyPage(client, "user-1");
    expect(result?.id).toBe("await-1");
    expect(result?.display_state).toBe("action_awaiting_verification");
  });

  it("keeps an approved+verified contract as verified_completed (verified_at gate excludes it from awaiting)", async () => {
    const verifiedRow = {
      id: "term-verified",
      contract_description: "done",
      deadline_at: FUTURE,
      verification_mode: "qr",
      status: "approved",
      session_id: "run-v",
      completion_method: "qr",
      completed_at: "2026-05-29T01:00:00.000Z",
      verified_at: "2026-05-29T01:00:00.000Z",
      validation_approved_at: "2026-05-29T00:00:00.000Z",
    };
    const { client } = makeSupabase((rec) => {
      if (rec.status === "pending") return { data: null, error: null };
      if (rec.statusIn?.includes("submitted")) return { data: null, error: null };
      if (rec.statusIn?.includes("completed")) return { data: [verifiedRow], error: null };
      return { data: null, error: null };
    });

    const result = await fetchOpenActionContractForMyPage(client, "user-1");
    expect(result?.id).toBe("term-verified");
    expect(result?.display_state).toBe("verified_completed");
  });

  it("broadens awaiting status to [approved, submitted] while preserving the validation-approved + unverified gate", async () => {
    const { client, queries } = makeSupabase((rec) => {
      if (rec.status === "pending") return { data: null, error: null };
      return rec.statusIn?.includes("completed") ? { data: [], error: null } : { data: null, error: null };
    });

    const result = await fetchOpenActionContractForMyPage(client, "user-1");
    expect(result).toBeNull();

    const awaiting = queries.find(
      (r) => Array.isArray(r.statusIn) && r.statusIn.includes("submitted") && !r.statusIn.includes("completed"),
    );
    expect(awaiting).toBeDefined();
    expect(awaiting!.calls).toContainEqual(["in", ["status", ["approved", "submitted"]]]);
    expect(awaiting!.calls).toContainEqual(["not", ["validation_approved_at", "is", null]]);
    expect(awaiting!.calls).toContainEqual(["is", ["verified_at", null]]);
  });
});

const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function awaitingRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "c1",
    contract_description: "Run the 1:1",
    deadline_at: FUTURE,
    verification_mode: "qr",
    verification_type: "action_completed",
    verification_tier: "mvp_open",
    status: "submitted",
    session_id: "run-1",
    run_id: "run-1",
    arena_scenario_id: "sc1",
    source: "arena_run_completion",
    validation_approved_at: "2026-05-29T00:00:00.000Z",
    verified_at: null,
    ...over,
  };
}

describe("fetchAwaitingVerificationContractsForMyPage — plural owner list (안2-B)", () => {
  it("includes a submitted + validation-approved + unverified contract (action_awaiting_verification)", async () => {
    const { client } = makeSupabase(() => ({
      data: [awaitingRow({ id: "sub-1", status: "submitted" })],
      error: null,
    }));
    const rows = await fetchAwaitingVerificationContractsForMyPage(client, "user-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("sub-1");
    expect(rows[0]?.display_state).toBe("action_awaiting_verification");
    expect(rows[0]?.verification_tier).toBe("mvp_open");
    expect(rows[0]?.source).toBe("arena_run_completion");
    expect(rows[0]?.action_text).toBe("Run the 1:1");
  });

  it("includes an approved + validation-approved + unverified contract", async () => {
    const { client } = makeSupabase(() => ({
      data: [awaitingRow({ id: "app-1", status: "approved", verification_tier: "manager_only" })],
      error: null,
    }));
    const rows = await fetchAwaitingVerificationContractsForMyPage(client, "user-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("app-1");
    expect(rows[0]?.display_state).toBe("action_awaiting_verification");
    expect(rows[0]?.verification_tier).toBe("manager_only");
  });

  it("returns all rows (no limit), preserving query order (deadline desc)", async () => {
    const { client } = makeSupabase(() => ({
      data: [
        awaitingRow({ id: "a" }),
        awaitingRow({ id: "b", deadline_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() }),
        awaitingRow({ id: "c", deadline_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() }),
      ],
      error: null,
    }));
    const rows = await fetchAwaitingVerificationContractsForMyPage(client, "user-1");
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("filters out past-deadline rows (JS), keeps future ones", async () => {
    const { client } = makeSupabase(() => ({
      data: [awaitingRow({ id: "future" }), awaitingRow({ id: "expired", deadline_at: PAST })],
      error: null,
    }));
    const rows = await fetchAwaitingVerificationContractsForMyPage(client, "user-1");
    expect(rows.map((r) => r.id)).toEqual(["future"]);
  });

  // Gates (verified_at set / validation_approved_at null) are enforced query-side,
  // so they are asserted via the built query (a non-matching row never reaches the fn).
  it("builds the gate query: status in [approved,submitted] + validation_approved not null + verified_at null", async () => {
    const { client, queries } = makeSupabase(() => ({ data: [], error: null }));
    const rows = await fetchAwaitingVerificationContractsForMyPage(client, "user-1");
    expect(rows).toEqual([]);
    expect(queries[0]!.calls).toContainEqual(["in", ["status", ["approved", "submitted"]]]);
    expect(queries[0]!.calls).toContainEqual(["not", ["validation_approved_at", "is", null]]);
    expect(queries[0]!.calls).toContainEqual(["is", ["verified_at", null]]);
  });
});
