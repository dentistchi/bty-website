import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claimAssignmentForParticipant } from "./foundryAssignmentPublishService";

/**
 * R4-R5B1 — THE ASSIGNMENT CLAIM MUST NEVER THROW INTO THE COMPLETION PATH.
 *
 * Since R4-R5B1 this helper is called from all three `complete*Training` services, where a rejection
 * would fail a training completion the learner has already truthfully earned. It is the ONE place
 * the guarantee lives, so all three families inherit it from here — which is why this is tested
 * against the REAL helper rather than against any service's module mock.
 *
 * The `{ error }` branch has always covered an RPC that ANSWERS with an error. It never covered one
 * that does not answer at all: a transport failure, an abort, a client that rejects. Its two
 * siblings in the same authenticated block (`materializeFollowupObligation`,
 * `materializeApplyWindow`) both state this contract explicitly; this brings the claim to parity.
 */
const admin = (rpc: unknown) => ({ rpc }) as unknown as SupabaseClient;

describe("claimAssignmentForParticipant — containment", () => {
  it("an RPC that ANSWERS with an error degrades to the silent not_applicable", async () => {
    const r = await claimAssignmentForParticipant(
      admin(vi.fn(async () => ({ data: null, error: { message: "boom" } }))),
      "ev-1",
      "pt-1",
      "user-1",
    );
    expect(r).toBe("not_applicable");
  });

  it("an RPC that REJECTS is contained — it resolves, it does not throw", async () => {
    await expect(
      claimAssignmentForParticipant(
        admin(vi.fn(async () => { throw new Error("transport failure"); })),
        "ev-1",
        "pt-1",
        "user-1",
      ),
    ).resolves.toBe("not_applicable");
  });

  it("a SYNCHRONOUS throw from the client is contained too", async () => {
    await expect(
      claimAssignmentForParticipant(
        admin(() => { throw new Error("sync explode"); }),
        "ev-1",
        "pt-1",
        "user-1",
      ),
    ).resolves.toBe("not_applicable");
  });

  it("neither failure mode reports a transition — not_applicable is the SILENT outcome", async () => {
    // The completion result contract carries no assignment field at all, and `not_applicable` is
    // the value the UI is documented to stay silent on. So a fault can never read as "completed".
    for (const rpc of [
      vi.fn(async () => ({ data: null, error: { message: "x" } })),
      vi.fn(async () => { throw new Error("x"); }),
    ]) {
      const r = await claimAssignmentForParticipant(admin(rpc), "ev-1", "pt-1", "user-1");
      expect(r).not.toBe("claimed");
      expect(r).not.toBe("already_claimed");
    }
  });

  it("a real answer still passes through unchanged (containment did not swallow success)", async () => {
    for (const result of ["claimed", "already_claimed", "claim_conflict", "no_matching_assignment", "not_applicable"]) {
      const r = await claimAssignmentForParticipant(
        admin(vi.fn(async () => ({ data: [{ result, assignment_id: "a1" }], error: null }))),
        "ev-1",
        "pt-1",
        "user-1",
      );
      expect(r).toBe(result);
    }
  });

  it("the match keys sent are exactly the server-derived pair (+ the recorded participant)", async () => {
    const rpc = vi.fn(async () => ({ data: [{ result: "claimed", assignment_id: "a1" }], error: null }));
    await claimAssignmentForParticipant(admin(rpc), "ev-9", "pt-9", "user-9");
    expect(rpc).toHaveBeenCalledWith("bty_foundry_claim_assignment", {
      p_event_id: "ev-9",
      p_participant_id: "pt-9",
      p_auth_user_id: "user-9",
    });
  });
});
