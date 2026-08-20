import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTrainingOutcome } from "./foundryTrainingOutcomeService";

/**
 * R4-R3A-R1 — THE OUTCOME VIEW MUST NAME THE CAUSE IT ACTUALLY MEASURED.
 *
 * R4-R3A decided "was a follow-up set up for this training?" by reading the Journey. The write
 * path never reads the Journey: `materializeFollowupObligation` asks `isFollowUpDays` about the
 * frozen `module_snapshot.followUpDays` and nothing else. A read that asks a different question
 * from the write it describes is not a wording problem — it is a false statement, and production
 * measured the size of it: of 31 events with completions, 17 were told "This training ends at
 * completion. No follow-up was set up for it." while their own snapshot carried a 7- or 30-day
 * checkpoint. On those trainings the real reason no obligation existed was that the people who
 * finished never signed in, and the Host was pointed at the wrong thing entirely.
 *
 * These tests hold the two contracts apart at the SERVICE boundary — the follow-up capability and
 * the application-journey capability are read from the fields that gate them, separately, and
 * neither may be derived from the other.
 */

const OWNER = "owner-1";
const EVENT = "ev-1";

type Snapshot = Record<string, unknown>;

type Fixture = {
  snapshot?: Snapshot | null;
  /** null models "no module row at all". */
  hasModuleRow?: boolean;
  completions?: { linked: boolean; decision?: string }[];
  followUps?: { id: string; status: string; outcome: string | null; due_at: string }[];
  observations?: Record<string, unknown>[];
  joined?: number;
};

/** A journey carrying exactly the named grounded element kinds. */
function journey(...kinds: string[]) {
  return { elements: kinds.map((kind) => ({ kind, confirmationStatus: "grounded", content: "x" })) };
}

function admin(f: Fixture): SupabaseClient {
  const joined = f.joined ?? (f.completions?.length ?? 0);
  const rows: Record<string, unknown[]> = {
    foundry_events: [{ id: EVENT }],
    foundry_event_participants: Array.from({ length: joined }, (_, i) => ({ id: `p${i}`, status: "joined" })),
    foundry_event_training_progress: (f.completions ?? []).map((c, i) => ({
      id: `pr${i}`,
      completed_at: "2026-08-15T12:30:35Z",
      linked_user_id: c.linked ? `u${i}` : null,
      decision_response_text: c.decision ?? null,
      // Never requested by the service — present to prove they cannot pass through.
      response_text: "PRIVATE-COMPLETION-ANSWER",
      learner_reflection_text: "PRIVATE-REFLECTION-BODY",
      reflection: { livingSentence: "PRIVATE-GENERATED-REFLECTION" },
    })),
    foundry_participant_followups: f.followUps ?? [],
    foundry_behavior_observations: f.observations ?? [],
    foundry_event_module: f.hasModuleRow === false ? [] : [{ module_snapshot: f.snapshot ?? {} }],
  };
  const from = (table: string) => {
    const q: Record<string, unknown> = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      in() {
        return this;
      },
      /* R4-R3B2 — reachability filters `user_id_snapshot` NOT NULL on an id-only follow-up read. */
      not() {
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
  };
  return { from } as unknown as SupabaseClient;
}

const NOW = new Date("2026-08-19T12:00:00Z");
const TZ = "America/Los_Angeles";
const read = (f: Fixture) => getTrainingOutcome(admin(f), OWNER, EVENT, NOW, TZ);

/*
  R4-R3B2 — an obligation BELONGS to a completion, and reachability is now read from that link, so
  the fixture has to carry it. Defaults to the first completion (`pr0`), which is what a follow-up
  materialized for a real learner looks like.
*/
const PENDING = (id = "f1", progressId: string | null = "pr0") => ({
  id,
  progress_id: progressId,
  user_id_snapshot: "u0",
  status: "PENDING",
  outcome: null,
  due_at: "2026-08-22T05:00:00Z",
});

describe("R4-R3A-R1 · 1 · an absent checkpoint is the ONLY true end-at-completion state", () => {
  it("no module row at all → not configured", async () => {
    const out = await read({ hasModuleRow: false, completions: [{ linked: true }] });
    expect(out?.followUp.configured).toBe(false);
    expect(out?.followUp.days).toBeNull();
    expect(out?.reading).toBe("ends_at_completion");
  });

  it("followUpDays absent from the snapshot → not configured", async () => {
    const out = await read({ snapshot: { problem: "x" }, completions: [{ linked: true }] });
    expect(out?.followUp.configured).toBe(false);
    expect(out?.reading).toBe("ends_at_completion");
  });

  it("followUpDays 0 — the Host's explicit 'no checkpoint' — is not configured", async () => {
    const out = await read({ snapshot: { followUpDays: 0 }, completions: [{ linked: true }] });
    expect(out?.followUp.configured).toBe(false);
    expect(out?.followUp.days).toBeNull();
    expect(out?.reading).toBe("ends_at_completion");
  });

  it("a value outside the write path's domain is not silently honoured", async () => {
    // `isFollowUpDays` is the SAME predicate the writer asks. 14 materializes nothing, so it
    // must not be reported as a configured checkpoint either.
    const out = await read({ snapshot: { followUpDays: 14 }, completions: [{ linked: true }] });
    expect(out?.followUp.configured).toBe(false);
  });
});

describe("R4-R3A-R1 · 2/3 · a configured checkpoint never reads as end-at-completion", () => {
  for (const days of [7, 30] as const) {
    it(`followUpDays ${days} reports configured, whatever else is missing`, async () => {
      const out = await read({ snapshot: { followUpDays: days }, completions: [{ linked: false }] });
      expect(out?.followUp.configured).toBe(true);
      expect(out?.followUp.days).toBe(days);
      expect(out?.reading).not.toBe("ends_at_completion");
    });
  }
});

describe("R4-R3A-R1 · 7/8 · the Journey does not speak for the follow-up", () => {
  it("7 — no Journey at all, checkpoint set: configured, and the journey state is reported apart", async () => {
    const out = await read({ snapshot: { followUpDays: 7 }, completions: [{ linked: false }] });
    expect(out?.followUp.configured).toBe(true);
    expect(out?.applicationJourney).toBe("none");
  });

  it("8 — a Journey with no grounded action_decision does not un-configure the follow-up", async () => {
    const out = await read({
      snapshot: { followUpDays: 30, realityGroundedJourneyV1: journey("why_it_matters", "field_application") },
      completions: [{ linked: false }],
    });
    expect(out?.followUp.configured).toBe(true);
    expect(out?.applicationJourney).toBe("journey_no_decision");
  });

  it("the converse also holds — a grounded action_decision does not invent a checkpoint", async () => {
    const out = await read({
      snapshot: { followUpDays: 0, realityGroundedJourneyV1: journey("action_decision") },
      completions: [{ linked: true, decision: "I will name one owner." }],
    });
    expect(out?.applicationJourney).toBe("action_decision");
    expect(out?.followUp.configured).toBe(false);
    expect(out?.reading).toBe("ends_at_completion");
  });

  it("action_decision is recognised and carried, without deciding anything about follow-up", async () => {
    const out = await read({
      snapshot: { followUpDays: 7, realityGroundedJourneyV1: journey("observable_standard", "action_decision") },
      completions: [{ linked: true }],
      followUps: [PENDING()],
    });
    expect(out?.applicationJourney).toBe("action_decision");
    expect(out?.followUp.configured).toBe(true);
  });
});

describe("R4-R3A-R1 · 4/5/6 · the three configured states are told apart", () => {
  it("4 — configured, every completion anonymous, no obligation: the shortfall is reported", async () => {
    const out = await read({
      snapshot: { followUpDays: 7 },
      completions: [{ linked: false }, { linked: false }],
      followUps: [],
    });
    expect(out?.reading).toBe("awaiting_connection");
    expect(out?.followUp.days).toBe(7);
    expect(out?.participation.followUpNotConnected).toBe(2);
    expect(out?.followUp.total).toBe(0);
  });

  it("5 — configured with a linked pending obligation: normal evidence, classified by day key", async () => {
    const out = await read({
      snapshot: { followUpDays: 7 },
      completions: [{ linked: true }],
      followUps: [PENDING()],
    });
    expect(out?.reading).toBe("unknown_yet");
    expect(out!.followUp.waiting + out!.followUp.overdue).toBe(1);
    expect(out?.followUp.total).toBe(1);
  });

  it("6 — mixed: the real obligation is reported AND the unconnected completions remain visible", async () => {
    const out = await read({
      snapshot: { followUpDays: 7 },
      completions: [{ linked: true }, { linked: false }, { linked: false }],
      followUps: [PENDING()],
    });
    // The evidence is NOT suppressed because some completions were anonymous.
    expect(out?.followUp.total).toBe(1);
    expect(out?.reading).toBe("unknown_yet");
    // And the identity gap is still carried, for the panel to explain separately.
    expect(out?.participation.followUpNotConnected).toBe(2);
  });

  it("configured, nobody has finished yet: nothing to report, and nobody is blamed", async () => {
    const out = await read({ snapshot: { followUpDays: 7 }, completions: [], joined: 4 });
    expect(out?.reading).toBe("nothing_yet");
    expect(out?.participation.followUpNotConnected).toBe(0);
  });
});

describe("R4-R3A-R1 · D · the two Founder-tested trainings, as production holds them", () => {
  it("Confirm Patient Understanding — followUpDays 7, no Journey, 2 unconnected completions", async () => {
    const out = await read({
      snapshot: { followUpDays: 7 },
      joined: 3,
      completions: [{ linked: false }, { linked: false }],
      followUps: [],
    });
    // The shipped defect: this training was told it had no follow-up configured. It has one.
    expect(out?.followUp.configured).toBe(true);
    expect(out?.followUp.days).toBe(7);
    expect(out?.reading).toBe("awaiting_connection");
    expect(out?.applicationJourney).toBe("none");
    expect(out?.participation).toEqual({ joined: 3, completed: 2, followUpReachable: 0, followUpNotConnected: 2 });
  });

  it("Establishing Action Ownership in Huddles — evidence rendering is UNCHANGED", async () => {
    const out = await read({
      snapshot: { followUpDays: 7, realityGroundedJourneyV1: journey("observable_standard", "action_decision") },
      joined: 1,
      completions: [{ linked: true, decision: "At my next huddle, I will name one owner and one deadline." }],
      followUps: [PENDING()],
      observations: [{ followup_id: "f1", outcome: "UNABLE_TO_TELL" }],
    });
    expect(out?.followUp.waiting).toBe(1);
    expect(out?.followUp.overdue).toBe(0);
    expect(out?.observation).toEqual({ confirmed: 0, notEstablished: 0, couldntTell: 1, total: 1 });
    expect(out?.reading).toBe("unknown_yet");
    expect(out?.decisionCount).toBe(1);
    expect(out?.applicationJourney).toBe("action_decision");
  });
});

describe("R4-R3A-R1 · 9/10/11 · the R4-R3A guarantees are unchanged by this repair", () => {
  const rich: Fixture = {
    snapshot: { followUpDays: 7, realityGroundedJourneyV1: journey("action_decision") },
    completions: [{ linked: true, decision: "Name one owner and one deadline." }, { linked: false }],
    followUps: [PENDING()],
    observations: [
      { followup_id: "f1", outcome: "UNABLE_TO_TELL" },
      { followup_id: "f1", outcome: "UNABLE_TO_TELL", observer_user_id: "OBSERVER-IDENTITY" },
    ],
  };

  it("9 — no private learner content appears in the payload", async () => {
    const json = JSON.stringify(await read(rich));
    for (const k of ["response_text", "learner_reflection_text", "reflection"]) expect(json).not.toContain(k);
    expect(json).not.toContain("PRIVATE-COMPLETION-ANSWER");
    expect(json).not.toContain("PRIVATE-REFLECTION-BODY");
    expect(json).not.toContain("PRIVATE-GENERATED-REFLECTION");
  });

  it("10 — no observer identity, and the decision is still unattributed", async () => {
    const json = JSON.stringify(await read(rich));
    expect(json).not.toContain("observer_user_id");
    expect(json).not.toContain("OBSERVER-IDENTITY");
    expect(json).not.toContain("linked_user_id");
    expect(json).not.toContain("u0");
  });

  it("11 — the new capability read issues no insert, update, upsert, delete or rpc", async () => {
    const touched: string[] = [];
    const base = admin(rich) as unknown as Record<string, unknown>;
    const realFrom = base.from as (t: string) => Record<string, unknown>;
    base.from = (t: string) => {
      const q = realFrom(t);
      for (const m of ["insert", "update", "upsert", "delete"]) {
        q[m] = () => {
          touched.push(`${t}.${m}`);
          return q;
        };
      }
      return q;
    };
    base.rpc = () => {
      touched.push("rpc");
      return Promise.resolve({ data: null, error: null });
    };
    await getTrainingOutcome(base as unknown as SupabaseClient, OWNER, EVENT, NOW, TZ);
    expect(touched).toEqual([]);
  });

  it("an event the caller does not own still resolves to nothing", async () => {
    const a = admin(rich) as unknown as { from: (t: string) => Record<string, unknown> };
    const orig = a.from;
    a.from = (t: string) => {
      const q = orig(t);
      if (t === "foundry_events") q.maybeSingle = () => Promise.resolve({ data: null, error: null });
      return q;
    };
    expect(await getTrainingOutcome(a as unknown as SupabaseClient, "someone-else", EVENT, NOW, TZ)).toBeNull();
  });
});
