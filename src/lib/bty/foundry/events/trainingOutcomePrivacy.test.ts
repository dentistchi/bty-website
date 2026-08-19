import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTrainingOutcome } from "./foundryTrainingOutcomeService";

/**
 * R4-R3A — THE PRIVACY BOUNDARY IS THE SELECT LIST, NOT THE UI.
 *
 * `response_text` (the private completion-check answer), `learner_reflection_text` (the private
 * reflection) and the generated `reflection` jsonb must never reach a Host. Hiding them in React
 * would not be enough: anything the service SELECTS can be read from the network response by
 * anyone holding the Host's session.
 *
 * So these tests assert two different things, and both matter:
 *   1. the service never NAMES a private column in any query it issues, and
 *   2. no private key can appear in the serialized payload even when the fake DB hands them back
 *      unasked — which is what would happen if someone later replaced the allow-list with `*`.
 *
 * `decision_response_text` IS authorised (declared on the column since 3.2M-1 and already carried
 * by the shared-review allow-list) and is returned deliberately — unattributed, with no learner id.
 */

const OWNER = "owner-1";
const EVENT = "ev-1";

type Cap = { table: string; selected: string };

/**
 * A fake that RECORDS every column list requested, and deliberately returns private columns the
 * service never asked for. If the service leaked them into its payload, the second test fails.
 */
function makeAdmin(captures: Cap[]) {
  const rows: Record<string, unknown[]> = {
    foundry_events: [{ id: EVENT }],
    foundry_event_participants: [
      { id: "p1", status: "joined" },
      { id: "p2", status: "joined" },
    ],
    foundry_event_training_progress: [
      {
        id: "pr1",
        completed_at: "2026-08-15T12:30:35Z",
        linked_user_id: "u1",
        decision_response_text: "At my next huddle I will name one owner and one deadline.",
        // NEVER requested — present only to prove the service cannot pass them through.
        response_text: "PRIVATE-COMPLETION-ANSWER",
        learner_reflection_text: "PRIVATE-REFLECTION-BODY",
        reflection: { livingSentence: "PRIVATE-GENERATED-REFLECTION" },
      },
    ],
    foundry_participant_followups: [
      { id: "f1", status: "PENDING", outcome: null, due_at: "2026-08-22T05:00:00Z" },
    ],
    foundry_behavior_observations: [
      { followup_id: "f1", outcome: "UNABLE_TO_TELL" },
      // Volunteered, never requested — proves observer identity cannot leak through.
      { followup_id: "f1", outcome: "UNABLE_TO_TELL", observer_user_id: "OBSERVER-IDENTITY" },
    ],
    foundry_event_module: [
      {
        module_snapshot: {
          realityGroundedJourneyV1: {
            elements: [{ kind: "action_decision", confirmationStatus: "grounded", content: "x" }],
          },
        },
      },
    ],
  };

  function from(table: string) {
    const q: Record<string, unknown> = {
      _sel: "",
      select(this: Record<string, unknown>, cols: string) {
        this._sel = cols;
        captures.push({ table, selected: cols });
        return this;
      },
      eq() {
        return this;
      },
      in() {
        return this;
      },
      maybeSingle() {
        return Promise.resolve({ data: (rows[table] ?? [])[0] ?? null, error: null });
      },
      returns() {
        return Promise.resolve({ data: rows[table] ?? [], error: null });
      },
    };
    return q;
  }
  return { from } as unknown as SupabaseClient;
}

const PRIVATE_KEYS = ["response_text", "learner_reflection_text", "reflection"];

describe("R4-R3A · 13–15 · private learner content never leaves the service", () => {
  it("no query NAMES a private column", async () => {
    const captures: Cap[] = [];
    await getTrainingOutcome(makeAdmin(captures), OWNER, EVENT, new Date("2026-08-19T12:00:00Z"), "UTC");

    expect(captures.length).toBeGreaterThan(0);
    for (const c of captures) {
      expect(c.selected).not.toMatch(/\bresponse_text\b/);
      expect(c.selected).not.toMatch(/\blearner_reflection_text\b/);
      // `reflection` as a standalone column — the generated jsonb. (`reflection_` prefixes are fine.)
      expect(c.selected).not.toMatch(/(^|[\s,])reflection([\s,]|$)/);
      // A wildcard would defeat the allow-list entirely.
      expect(c.selected).not.toBe("*");
    }
  });

  it("no private KEY or VALUE appears in the serialized payload, even when the DB volunteers them", async () => {
    const captures: Cap[] = [];
    const out = await getTrainingOutcome(makeAdmin(captures), OWNER, EVENT, new Date("2026-08-19T12:00:00Z"), "UTC");
    const json = JSON.stringify(out);

    for (const key of PRIVATE_KEYS) expect(json).not.toContain(key);
    expect(json).not.toContain("PRIVATE-COMPLETION-ANSWER");
    expect(json).not.toContain("PRIVATE-REFLECTION-BODY");
    expect(json).not.toContain("PRIVATE-GENERATED-REFLECTION");
  });

  it("12 — the authorised decision text IS returned, and carries no learner identity", async () => {
    const out = await getTrainingOutcome(makeAdmin([]), OWNER, EVENT, new Date("2026-08-19T12:00:00Z"), "UTC");
    expect(out?.decisionCount).toBe(1);
    expect(out?.decisions).toEqual(["At my next huddle I will name one owner and one deadline."]);
    // No identifier rides along with it — this slice was told not to widen identity exposure.
    const json = JSON.stringify(out);
    expect(json).not.toContain("linked_user_id");
    expect(json).not.toContain("u1");
    expect(json).not.toContain("participant_id");
    // Observer identity is never selected and never surfaces.
    expect(json).not.toContain("observer_user_id");
    expect(json).not.toContain("OBSERVER-IDENTITY");
  });

  it("an event the caller does not own resolves to nothing, non-disclosingly", async () => {
    const admin = makeAdmin([]);
    // The ownership probe is the first query; make it miss.
    const orig = (admin as unknown as { from: (t: string) => unknown }).from;
    (admin as unknown as { from: (t: string) => unknown }).from = (t: string) => {
      const q = orig(t) as Record<string, unknown>;
      if (t === "foundry_events") q.maybeSingle = () => Promise.resolve({ data: null, error: null });
      return q;
    };
    const out = await getTrainingOutcome(admin, "someone-else", EVENT, new Date(), "UTC");
    expect(out).toBeNull();
  });
});

describe("R4-R3A · 18 · there is no write path", () => {
  it("the service issues no insert, update, upsert, delete or rpc", async () => {
    const forbidden = ["insert", "update", "upsert", "delete", "rpc"];
    const touched: string[] = [];
    const captures: Cap[] = [];
    const admin = makeAdmin(captures) as unknown as Record<string, unknown>;
    const realFrom = admin.from as (t: string) => Record<string, unknown>;
    admin.from = (t: string) => {
      const q = realFrom(t);
      for (const m of forbidden) {
        q[m] = () => {
          touched.push(`${t}.${m}`);
          return q;
        };
      }
      return q;
    };
    admin.rpc = () => {
      touched.push("rpc");
      return Promise.resolve({ data: null, error: null });
    };

    await getTrainingOutcome(admin as unknown as SupabaseClient, OWNER, EVENT, new Date("2026-08-19T12:00:00Z"), "UTC");
    expect(touched).toEqual([]);
  });
});
