import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * R4-R7A — the publish gate, and the silent bypass it closes.
 *
 * The pre-fix defect in one line: every completeness check lived inside `if (journeyEnabled)`,
 * and `journeyEnabled` is `journey !== undefined`. A draft with no journey skipped all of them,
 * including the Host's own declared follow-up intent.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const code = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const PUB = "src/lib/bty/foundry/events/foundryPublishService.ts";
const SHELL = "src/components/foundry/event-rooms/ModuleBuilderShell.tsx";

describe("T14 — the no-Journey bypass is closed WITHOUT requiring a Journey", () => {
  const c = code(read(PUB));

  it("the intent check runs OUTSIDE the journeyEnabled block", () => {
    const enabledBlock = c.indexOf("if (journeyEnabled) {");
    const intent = c.indexOf("classifyRealityIntentReadiness(answers, journey)");
    expect(intent).toBeGreaterThan(-1);
    // Not nested inside it: the closing brace of that block precedes the intent call.
    const closeOfBlock = c.indexOf("}", c.indexOf("program_sections_missing"));
    expect(intent).toBeGreaterThan(closeOfBlock);
    expect(enabledBlock).toBeLessThan(intent);
  });

  it("T6/T11 — both repairable gaps refuse publish, each with its own reason", () => {
    expect(c).toContain('return { ok: false, reason: "field_action_missing" }');
    expect(c).toContain('return { ok: false, reason: "decision_missing" }');
  });

  it("publish still never demands a Journey object", () => {
    expect(c).not.toMatch(/journey === undefined[^\n]*return \{ ok: false/);
    // The pre-existing kinds check keeps its original, narrower scope.
    expect(c).toContain("if (journeyEnabled) {");
    expect(c).toContain("missingProgramKinds(answers, journey)");
  });

  it("Review and Publish share ONE classifier — no restated conditions", () => {
    expect(c).toContain("classifyRealityIntentReadiness");
    const shell = code(read(SHELL));
    expect(shell).toContain("classifyRealityIntentReadiness(answers, journey)");
    // The shell must not re-derive the rule in JSX.
    expect(shell).not.toMatch(/followUpDays[^\n]*>\s*0[^\n]*&&[^\n]*field/i);
    expect(shell).not.toMatch(/learningNeeds[^\n]*includes\("decide"\)/);
  });
});

describe("T5/T10 — Review tells the truth, in the Host's language", () => {
  const shell = code(read(SHELL));
  const copy = read("src/components/foundry/event-rooms/moduleBuilderCopy.ts");

  it("the gap block renders only when a gap exists", () => {
    expect(shell).toContain("{realityIntent.missing.length > 0 ? (");
    expect(shell).toContain('data-testid="reality-gap-field-action"');
    expect(shell).toContain('data-testid="reality-gap-decision"');
  });

  it("T13/T3 — a training with no behaviour intent renders nothing at all", () => {
    // The only guard is the classifier's own output; nothing widens it.
    const at = shell.indexOf('data-testid="reality-intent-gap"');
    const guard = shell.slice(Math.max(0, at - 320), at);
    expect(guard).toContain("realityIntent.missing.length > 0");
    expect(guard).not.toMatch(/journey|followUpDays|learningNeeds/);
  });

  it("the publish refusal repeats the SAME sentence Review showed", () => {
    expect(shell).toContain('case "field_action_missing":');
    expect(shell).toContain("return t.realityMissingFieldAction;");
    expect(shell).toContain('case "decision_missing":');
    expect(shell).toContain("return t.realityMissingDecision;");
  });

  it("no internal vocabulary reaches the Host", () => {
    const strings = [...copy.matchAll(/reality(?:Missing\w+|FixCta): ?\n?\s*"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] ?? "");
    expect(strings.length, "3 keys x 2 locales").toBe(6);
    const forbidden = /journey|grounded|field_application|action_decision|missingProgramKinds|confirmationStatus|여정/i;
    expect(strings.filter((v) => forbidden.test(v))).toEqual([]);
  });

  it("EN and KO say act-and-what-is-missing, and name the fix", () => {
    expect(copy).toContain(
      '"You scheduled a follow-up, but this training does not yet say what the learner should try in real work."',
    );
    expect(copy).toContain(
      '"This training asks the learner to make a decision, but the decision they should make is not defined yet."',
    );
    expect(copy).toContain('"후속 확인이 예정되어 있지만, 학습자가 실제 업무에서 무엇을 해볼지는 아직 정해지지 않았습니다."');
    expect(copy).toContain('"이 학습은 학습자에게 결정을 요청하지만, 어떤 결정을 해야 하는지가 아직 정해지지 않았습니다."');
    expect(copy).toContain('realityFixCta: "Complete this part"');
    expect(copy).toContain('realityFixCta: "이 부분 완성하기"');
  });

  it("no new conceptual door was added", () => {
    const forbidden = /Create Journey|Configure Reality|Advanced settings|여정 만들기/i;
    expect(copy).not.toMatch(forbidden);
    expect(shell).not.toMatch(forbidden);
  });
});

describe("T7/§0 — the gate exists only because the repair path does", () => {
  it("the generator emits exactly the kinds the Host's intent requires", () => {
    const gen = read("src/lib/bty/foundry/events/programAuthorshipService.ts");
    expect(gen).toContain("requiredProgramKinds(args.answers)");
    // Per-kind authoring instructions exist for both repairable gaps.
    expect(gen).toContain("field_application:");
    expect(gen).toContain("action_decision:");
  });

  it("requiredProgramKinds still derives those from intent, not from a maximal ladder", () => {
    const auth = read("src/domain/foundry/module/program-authorship.ts");
    expect(auth).toContain('if (needs.includes("decide")) required.add("action_decision");');
    expect(auth).toContain('required.add("field_application");');
  });

  it("the Builder still offers the seeding control the fix starts from", () => {
    expect(read(SHELL)).toContain('data-testid="journey-start"');
  });
});

describe("§8/§17 — containment", () => {
  it("no migration, no schema, no learner-side change", () => {
    const c = code(read(PUB));
    expect(c).not.toMatch(/alter table|create table/i);
    for (const f of [
      "src/app/f/[token]/FoundryJoinClient.tsx",
      "src/lib/bty/daily/todayReminders.server.ts",
      "src/lib/bty/foundry/events/foundryApplyWindowService.ts",
      "src/lib/bty/foundry/events/foundryFollowupService.ts",
    ]) {
      expect(code(read(f)), f).not.toMatch(/classifyRealityIntentReadiness|realityMissing/);
    }
  });

  it("follow-up and Apply remain independent — the copy never says follow-up cannot exist", () => {
    /*
      Scoped to THIS SLICE's strings. A whole-file scan flagged the pre-existing, correct
      sentence shown when the Host chooses NO follow-up ("No follow-up will be created…") —
      which describes their own choice, not a consequence of a missing field action.
    */
    const copy = read("src/components/foundry/event-rooms/moduleBuilderCopy.ts");
    const mine = [...copy.matchAll(/reality(?:Missing\w+|FixCta): ?\n?\s*"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] ?? "");
    expect(mine.filter((v) => /follow-up cannot|후속 확인을 할 수 없|no follow-up will/i.test(v))).toEqual([]);
    const dom = read("src/domain/foundry/followup/followUpObligation.ts");
    expect(dom).toContain("export type FollowUpDays = 7 | 30;");
  });
});
