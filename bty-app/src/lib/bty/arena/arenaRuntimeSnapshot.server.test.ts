import { describe, expect, it } from "vitest";
import type { BlockingArenaContractRow } from "@/lib/bty/arena/blockingArenaActionContract";
import {
  gatesForBlockedContract,
  runtimeStateFromBlockingContract,
  snapshotForBlockedContract,
  statePriorityForRuntime,
} from "@/lib/bty/arena/arenaRuntimeSnapshot.server";

function row(overrides: Partial<BlockingArenaContractRow> = {}): BlockingArenaContractRow {
  return {
    id: "c1",
    contract_description: "desc",
    deadline_at: new Date(Date.now() + 86_400_000).toISOString(),
    verification_mode: "hybrid",
    verification_type: "qr",
    created_at: new Date().toISOString(),
    status: "pending",
    validation_approved_at: null,
    verified_at: null,
    ...overrides,
  };
}

describe("runtimeStateFromBlockingContract — H3 ACTION_ESCALATED (2026-05-26)", () => {
  it("maps escalated → ACTION_ESCALATED (distinct from submitted)", () => {
    expect(runtimeStateFromBlockingContract(row({ status: "escalated" }))).toBe("ACTION_ESCALATED");
  });

  it("keeps submitted → ACTION_SUBMITTED (no collapse regression)", () => {
    expect(runtimeStateFromBlockingContract(row({ status: "submitted" }))).toBe("ACTION_SUBMITTED");
  });

  it("keeps approved → ACTION_AWAITING_VERIFICATION and pending → ACTION_REQUIRED", () => {
    expect(runtimeStateFromBlockingContract(row({ status: "approved" }))).toBe(
      "ACTION_AWAITING_VERIFICATION",
    );
    expect(runtimeStateFromBlockingContract(row({ status: "pending" }))).toBe("ACTION_REQUIRED");
  });
});

describe("qrAllowedForContract (via gatesForBlockedContract) — escalated forward exit", () => {
  it("escalated + verified_at null → qr_allowed true (circuit breaker)", () => {
    expect(gatesForBlockedContract(row({ status: "escalated", verified_at: null })).qr_allowed).toBe(
      true,
    );
  });

  it("escalated + verified_at set → qr_allowed false (finished contract never re-offers QR)", () => {
    expect(
      gatesForBlockedContract(
        row({ status: "escalated", verified_at: new Date().toISOString() }),
      ).qr_allowed,
    ).toBe(false);
  });

  it("escalated gates: next/choice stay closed (still action-blocking)", () => {
    const gates = gatesForBlockedContract(row({ status: "escalated", verified_at: null }));
    expect(gates.next_allowed).toBe(false);
    expect(gates.choice_allowed).toBe(false);
  });
});

describe("snapshotForBlockedContract — escalated end-to-end", () => {
  it("escalated row → runtime_state ACTION_ESCALATED, priority 96, qr_allowed true", () => {
    const snap = snapshotForBlockedContract(row({ status: "escalated", verified_at: null }));
    expect(snap.runtime_state).toBe("ACTION_ESCALATED");
    expect(snap.state_priority).toBe(96);
    expect(snap.gates.qr_allowed).toBe(true);
  });

  it("statePriorityForRuntime(ACTION_ESCALATED) === 96 (between SUBMITTED 95 and AWAITING 100)", () => {
    expect(statePriorityForRuntime("ACTION_ESCALATED")).toBe(96);
    expect(statePriorityForRuntime("ACTION_SUBMITTED")).toBe(95);
    expect(statePriorityForRuntime("ACTION_AWAITING_VERIFICATION")).toBe(100);
  });
});
