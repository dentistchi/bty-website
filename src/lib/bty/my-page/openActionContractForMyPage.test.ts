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
import { fetchOpenActionContractForMyPage } from "./openActionContractForMyPage";

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
