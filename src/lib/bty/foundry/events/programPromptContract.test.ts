import { describe, it, expect } from "vitest";
import { systemPrompt } from "./programAuthorshipService";
import { PRESSURE_FRAMES, pressureFramePromptLines } from "@/domain/foundry/module/program-coherence";

/**
 * SLICE 3.2O-R1, REWRITTEN AT 3.2P-A7-R2 — the prompt is one half of a contract whose other
 * half is a validator.
 *
 * R1 existed because the no-second-occasion rule reached only one of the two pressure fields.
 * R2 derived the difficulty vocabulary from the policy so the two halves could not drift. Both
 * held, and A7 was refused twice anyway — the second time inside a repair that named the defect
 * in its opening sentence. The fields are gone; what the prompt now has to get right is that it
 * offers every frame the server knows and forbids nothing it cannot receive.
 */
const PROMPT = systemPrompt(
  "en",
  ["why_it_matters", "observable_standard", "scenario", "action_decision", "field_application", "completion_check", "follow_up"],
  "Nothing here can show that behaviour changed.",
  { exists: ["a video"], contentsVerified: false },
  ["- do not overclaim"],
);

describe("[3.2P-A7-R2] the scenario prompt asks for a CHOICE, not a sentence", () => {
  /*
    REPLACES two describe blocks — "the scenario prompt constrains BOTH pressure fields"
    (3.2O-R1) and "the prompt's pressure vocabulary is derived" (3.2O-R2). Both asserted that
    the prohibitions and the seventeen difficulty families reached the model. They did: A7 was
    refused twice against that exact prompt, once inside a repair that named the defect. The
    fields those rules protected are gone, so the rules are gone with them.
  */
  it("offers the twelve frames, derived from the policy, and asks for one", () => {
    const p = PROMPT;
    expect(p).toContain("Return scenario_contract with pressure_frame");
    for (const f of PRESSURE_FRAMES) expect(p, f.id).toContain(`- ${f.id}: ${f.meaning}`);
    expect(pressureFramePromptLines()).toHaveLength(PRESSURE_FRAMES.length);
  });

  it("no longer forbids what it can no longer receive", () => {
    const p = PROMPT;
    for (const retired of [
      "pressure_condition", "pressure_detail",
      "THIS APPLIES TO BOTH", "Forbidden in EITHER field",
      "any phrase that anchors a second time or event",
    ]) {
      expect(p, `retired prohibition still present: ${retired}`).not.toContain(retired);
    }
  });

  it("and it still asks for the difficulty that fits the host's problem", () => {
    expect(PROMPT).toContain("Choose the difficulty most plausible for the problem the host described");
  });
});
