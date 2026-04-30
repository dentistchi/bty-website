import { afterEach, describe, expect, it, vi } from "vitest";
import { ArenaChoiceHttpError, postArenaChoice } from "./postArenaChoice";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postArenaChoice error snapshot consumption", () => {
  it("parses blocked snapshot from 503 body and exposes it on ArenaChoiceHttpError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({
          error: "elite_action_contract_ensure_failed",
          mode: "arena",
          runtime_state: "ACTION_REQUIRED",
          state_priority: 90,
          gates: { next_allowed: false, choice_allowed: false, qr_allowed: true },
          action_contract: {
            exists: false,
            id: null,
            status: null,
            verification_type: null,
            deadline_at: null,
          },
        }),
      })),
    );

    await expect(
      postArenaChoice({
        run_id: "run-1",
        json_scenario_id: "core_01",
        db_scenario_id: "INCIDENT-01-OWN-01",
        json_choice_id: "AD1",
        db_choice_id: "db-ad1",
        binding_phase: "action_decision",
      }),
    ).rejects.toMatchObject({
      name: "ArenaChoiceHttpError",
      status: 503,
      snapshot: expect.objectContaining({
        runtime_state: "ACTION_REQUIRED",
        gates: { next_allowed: false, choice_allowed: false, qr_allowed: true },
      }),
    });
  });

  it("throws ArenaChoiceHttpError without snapshot when body is non-snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({ error: "db_scenario_mismatch" }),
      })),
    );
    await expect(
      postArenaChoice({
        run_id: "run-1",
        json_scenario_id: "core_01",
        db_scenario_id: "INCIDENT-01-OWN-01",
        json_choice_id: "AD1",
        db_choice_id: "db-ad1",
        binding_phase: "action_decision",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "ArenaChoiceHttpError",
        status: 409,
        snapshot: null,
      }),
    );
  });

  it("exports ArenaChoiceHttpError as Error subtype", () => {
    const err = new ArenaChoiceHttpError("x", 500, null);
    expect(err instanceof Error).toBe(true);
    expect(err.name).toBe("ArenaChoiceHttpError");
  });
});
