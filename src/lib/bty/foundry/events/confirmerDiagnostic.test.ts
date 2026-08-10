import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { finalizeProgramCall } from "./programGenerationRecorder";
import { validateProgramProposal, requiredProgramKinds } from "@/domain/foundry/module/program-authorship";
import { CONTRACT_FIELD_STORAGE } from "@/domain/foundry/module/program-coherence";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE 3.2P-R3.2-R2A — the confirmer refusal, end to end, with no provider.
 *
 * The validator decides it, the service passes it, and the live CHECK now accepts it — so the
 * whole diagnosis reaches the row instead of stopping at the field. Nothing here calls a model.
 */
const PILOT = {
  problem: "During morning huddles, team members report problems but leave without naming who will act or when the next step will happen.",
  audienceType: "leaders", evidenceType: "confirmed", followUpDays: 7,
  learningNeeds: ["shared_standard", "practice"], materialIntent: "pdf",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  arenaRecommended: true,
  completionPrompt: "What specific phrases will you use in the next huddle to confirm the action owner and deadline for each reported issue?",
  observableBehavior: "At the next huddle, what exact words will you use to confirm the owner, action, and deadline?",
  capabilityCandidate: "Accountability",
} as unknown as BuilderAnswers;

const KINDS = requiredProgramKinds(PILOT);
const CONTENT: Record<string, string> = {
  why_it_matters: "When a huddle ends without a named owner and a deadline, the problem that was raised stays exactly where it was.",
  observable_standard: "The huddle leader names one owner and one deadline for every agreed action before the group leaves.",
  scenario: "The huddle is running late and people are already standing to leave.",
  reflection: "In your own words, what is the most important standard from this training?",
  field_application: "At the next morning huddle, name one owner and one deadline for every agreed action and write them in the huddle note.",
  completion_check: "What exactly will you say at the next morning huddle to name the owner and the deadline?",
  follow_up: "In seven days you will be asked what you actually said at the huddle.",
};
const contract = (confirmedBy: string) => ({
  actor: "the huddle leader", trigger: "at each morning huddle, before the group leaves",
  observable_action: "names one owner and one deadline for every agreed action and writes them in the huddle note",
  completion: { confirmed_by: confirmedBy, confirmation_action: "repeat back the action and the deadline" },
});
const proposalWith = (confirmedBy: string) => ({
  program: {
    display_title: "End every huddle with an owner and a deadline",
    elements: KINDS.map((k) => ({ kind: k, content: CONTENT[k], rationale: "grounded" })),
    assumptions: [], warnings: [],
    behavior_contract: contract(confirmedBy),
    scenario_contract: { pressure_condition: "the huddle is running late and people are already standing to leave", pressure_detail: null },
    completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
    follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
  },
});

describe("[3.2P-R3.2-R2A] the fine-grained reason survives to the row", () => {
  it("the validator produces the exact diagnosis the service passes on", () => {
    const r = validateProgramProposal(proposalWith("the team lead"), PILOT, ["education.pdf"]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("non_observable_standard");
    expect(r.kind).toBe("observable_standard");
    expect(r.contract).toEqual({ field: "completionSignal", reason: "confirmer_unauthorized" });
    // The stored spelling the ledger uses.
    expect(CONTRACT_FIELD_STORAGE[r.contract!.field]).toBe("completion_signal");
  });

  it("and the recorder writes all four fields, now the live CHECK accepts the reason", async () => {
    const writes: Record<string, unknown>[] = [];
    const admin = {
      from() {
        let captured: Record<string, unknown> = {};
        const b: Record<string, unknown> = {
          update(p: Record<string, unknown>) { captured = p; return b; },
          eq() { writes.push(captured); return Promise.resolve({ data: null, error: null }); },
        };
        return b;
      },
    } as unknown as SupabaseClient;

    await finalizeProgramCall(admin, {
      callId: "ca110001-0000-4000-8000-000000000000",
      outcome: "schema_invalid",
      durationMs: 10,
      refusal: { code: "non_observable_standard", kind: "observable_standard" },
      diagnosis: { stage: "semantic", path: "elements.observable_standard", expected: "a grounded, honest value", actual: "string", retryable: false },
      behaviorContract: { field: "completion_signal", reason: "confirmer_unauthorized" },
    });
    expect(writes[0]).toMatchObject({
      refusal_code: "non_observable_standard",
      refusal_kind: "observable_standard",
      offending_path: "elements.observable_standard",
      behavior_contract_field: "completion_signal",
      behavior_contract_reason: "confirmer_unauthorized",
    });
  });

  it("a reason the live CHECK does not know is still withheld", async () => {
    const writes: Record<string, unknown>[] = [];
    const admin = {
      from() {
        let captured: Record<string, unknown> = {};
        const b: Record<string, unknown> = {
          update(p: Record<string, unknown>) { captured = p; return b; },
          eq() { writes.push(captured); return Promise.resolve({ data: null, error: null }); },
        };
        return b;
      },
    } as unknown as SupabaseClient;
    // `actor_unauthorized` was deliberately never added to the schema.
    await finalizeProgramCall(admin, {
      callId: "ca110002-0000-4000-8000-000000000000", outcome: "schema_invalid", durationMs: 10,
      behaviorContract: { field: "actor", reason: "actor_unauthorized" },
    });
    expect(writes[0].behavior_contract_reason).toBeNull();
  });
});
