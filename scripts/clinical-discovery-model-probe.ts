#!/usr/bin/env npx tsx
/**
 * CLINICAL DISCOVERY — local-model probe (operator-run, read-only).
 *
 * Calls the production router (`respondToDiscovery`) directly, with no database, session or trace.
 * Each request runs twice: authored rules only (allowModel false), then with the model, so a
 * paraphrase the rules cannot interpret is visible next to what the model selected.
 *
 *   CLINICAL_DISCOVERY_LLM_BASE_URL=… CLINICAL_DISCOVERY_LLM_MODEL=… [CLINICAL_DISCOVERY_LLM_KEY=…] \
 *     npx tsx scripts/clinical-discovery-model-probe.ts [--suite <name>] [--version <pack>] [--json out.json] [--bench N]
 *   npx tsx scripts/clinical-discovery-model-probe.ts --rescore measured.json --json rescored.json
 *
 * Scoring has two parts, both required for a correct row:
 * - Disclosure: `expect` lists fact-ID suffixes a correct interpretation must disclose; `accept` lists
 *   suffixes that are also a reasonable reading and are not counted as extra. [] means nothing may be
 *   disclosed (the doctor is asked to clarify). Extra = disclosed beyond expect+accept; missing = expected
 *   but not disclosed.
 * - Answer: every `answers` pattern must match the reply text, so the words shown actually answer the
 *   question, not merely carry a plausible fact ID. For expect [] the reply must disclose nothing.
 * `note` records why an expectation is a judgement call. Prints fact IDs, routing and the answer check;
 * `--show-text` also prints the reply text (local review only). The key is never printed.
 *
 * Set history (see docs/CLINICAL_DISCOVERY_MODEL_EVAL.md):
 * - tuning-1 and held-out-1 were frozen in 2eb5037e. held-out-1 was measured before AND after the round-1
 *   repair and its results were seen during that repair, so it is no longer unseen; round 2 tunes on it.
 * - held-out-2 was frozen before round 2 and measured three times without intervening code changes.
 *   The first two runs had shared-server contention; all measurements are preserved. Its exposed
 *   failures now inform round-3 regression repair, so it is no longer an unseen acceptance set.
 * - The expectations and answer checks of the first two sets were corrected when held-out-2 was frozen;
 *   `--rescore` re-scores the preserved round-1 measurements with them without re-running a model.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { respondToDiscovery } from "@/lib/bty/clinical-pilot/discovery-router.server";
import { discoveryPatients } from "@/lib/bty/clinical-pilot/discovery-cases.server";
import type { DiscoveryChannel } from "@/domain/clinical-pilot/discovery";

type Turn = { question: string; channel: DiscoveryChannel };
type Options = { after?: Turn[]; accept?: string[]; answers?: RegExp[]; note?: string };
type Probe = Turn & Options & { expect: string[] };
const P = (question: string, expect: string[], o: Options = {}): Probe => ({ question, channel: "patient", expect, ...o });
const E = (question: string, expect: string[], o: Options = {}): Probe => ({ question, channel: "exam", expect, ...o });
const p = (question: string): Turn => ({ question, channel: "patient" });
const e = (question: string): Turn => ({ question, channel: "exam" });

const COLD = /\bcold\b/i, HOT = /\b(?:hot|heat)\b/i, BRIEF = /\b(?:briefly|linger|seconds?)\b/i;
const SPONTANEOUS = /\b(?:on its own|by itself)\b/i, HEALTH = /\bmedical conditions?\b/i;
const CHEW_CHANGE = /\b(?:avoid|left side|other side)\b/i, CONTROL = /\b(?:contralateral|other side|opposite)\b/i;

/** Case 001 variant B. Used while repairing round 1: the first measured set plus same-meaning variants of each reported error. */
const TUNING_1: Probe[] = [
  P("Does anything you drink make it twinge?", ["cold", "heat"], { accept: ["sweets"], answers: [COLD, HOT],
    note: "A sugary drink is a drink, so disclosing sweets is a reasonable reading, not over-disclosure." }),
  P("Does it ever ache while you're sleeping?", ["night"], { answers: [/\bnight\b/i] }),
  P("Does it act up all by itself, even when you're not eating?", ["spontaneous"], { answers: [SPONTANEOUS] }),
  P("Are you on any drugs your doctor gave you?", ["medications"], { answers: [/\bmedications?\b/i] }),
  P("Any illnesses I should know about?", ["medical-history"], { answers: [HEALTH] }),
  P("Has anyone ever said you gnash your teeth?", ["bruxism"], { answers: [/\bgrind/i] }),
  E("Let me knock on the tooth with the mirror handle.", ["percussion"], { answers: [/\bpercussion\b/i] }),
  E("Shine a light through the tooth.", ["transillumination"], { answers: [/\btransillumination\b/i] }),
  E("Measure the gum depth around it.", ["probing"], { answers: [/\bprobing\b.*\bmm\b/i] }),
  E("Take a picture of the root tip.", ["pa"], { answers: [/\b(?:periapical|radiograph)\b/i] }),
  E("Put some ice on the tooth and see how it reacts.", ["cold-test"], { answers: [COLD] }),
  P("How long ago was it put in?", ["restoration-age"], { after: [e("Is there a filling in that tooth?")], answers: [/\byears? ago\b/i] }),
  P("Does it hang around afterwards?", ["cold"], { after: [p("Does cold bother it?")], answers: [COLD, BRIEF] }),
  P("What about at night?", ["night"], { after: [p("Does it hurt when you chew?")], answers: [/\bnight\b/i] }),
  P("How bad is it, from one to ten?", ["pain-severity"], { answers: [/\bout of 10\b/i] }),
  P("Have you changed how you eat because of it?", ["chewing-avoidance"], { answers: [CHEW_CHANGE] }),
  P("Do you light up at all?", ["tobacco"], { answers: [/\bsmoke\b/i] }),
  P("How often do you get your teeth cleaned?", ["last-visit"], { answers: [/\b(?:once|twice|every)\b.*\b(?:year|months?)\b/i],
    note: "Asks how often, so the answer must give a frequency, not only the last date." }),
  E("Check whether it wobbles.", ["mobility"], { answers: [/\bmobility\b/i] }),
  E("Use the pulp tester on it.", ["ept"], { answers: [/\belectric pulp\b/i] }),
  E("Press along the gum beside the roots.", ["palpation"], { answers: [/\bpalpation\b/i] }),
  E("Compare with the same tooth on the other side.", ["adjacent-teeth"], { answers: [CONTROL],
    note: "Asks about the contralateral tooth, so the answer must speak about it, not only the adjacent teeth." }),
  E("Can we get a 3-D scan of the area?", ["cbct"], { answers: [/\bcone-beam\b/i] }),
  E("What is their blood pressure?", []),
  P("What's the weather like?", []),
  E("Which test should I do next?", []),
  // Same-meaning variants of the reported errors.
  P("Do drinks bother it at all?", ["cold", "heat"], { accept: ["sweets"], answers: [COLD, HOT],
    note: "A sugary drink is a drink, so disclosing sweets is a reasonable reading, not over-disclosure." }),
  P("Do you have any diseases?", ["medical-history"], { answers: [HEALTH] }),
  P("Does the feeling stay for a while?", ["cold"], { after: [p("Is it sensitive to cold?")], answers: [COLD, BRIEF],
    note: "\"The feeling\" refers to the cold sensation just asked about. Pain severity describes biting episodes and adds an intensity nobody asked for." }),
  E("Check the tooth on the opposite side too.", ["adjacent-teeth"], { answers: [CONTROL] }),
  P("Does it hurt for no reason, without biting?", ["spontaneous"], { answers: [SPONTANEOUS] }),
  P("Has this changed the way you chew?", ["chewing-avoidance"], { answers: [CHEW_CHANGE] }),
];

/** Frozen before round 1. Measured before and after the round-1 repair, so it is no longer unseen. */
const HELD_OUT_1: Probe[] = [
  P("Is it sensitive to iced water?", ["cold"], { answers: [COLD] }),
  P("Do hot or cold drinks set it off?", ["cold", "heat"], { answers: [COLD, HOT] }),
  P("Does a sip of coffee bother it?", ["heat"], { accept: ["cold"], answers: [HOT],
    note: "Coffee is usually hot, so heat must be answered; iced coffee makes cold a reasonable addition." }),
  P("Have you been diagnosed with anything?", ["medical-history"], { answers: [HEALTH] }),
  P("Do you chew tobacco?", ["tobacco"], { answers: [/\btobacco\b/i],
    note: "Not smoking or vaping does not answer whether the patient chews tobacco." }),
  P("Do you avoid eating on that side?", ["chewing-avoidance"], { answers: [CHEW_CHANGE] }),
  P("Is the pain there when you're just sitting still?", ["spontaneous"], { answers: [SPONTANEOUS] }),
  P("Do you favour one side when chewing now?", ["chewing-avoidance"], { answers: [CHEW_CHANGE] }),
  E("Check the teeth beside it.", ["adjacent-teeth"], { answers: [/\badjacent\b/i] }),
  E("Test the opposite molar as a control.", ["adjacent-teeth"], { answers: [CONTROL] }),
  E("Check around its edges.", ["margins"], { after: [e("Is there a filling in that tooth?")], answers: [/\bmargins?\b/i] }),
  P("Does it linger?", ["cold"], { after: [p("Does cold bother it?")], answers: [COLD, BRIEF] }),
  P("And hot ones?", ["heat"], { after: [p("Do cold drinks bother it?")], answers: [HOT] }),
  P("When did it start this time?", ["symptom-duration"], { after: [p("Have you had this before?")], answers: [/\bago\b/i] }),
  P("Does it bother you?", []),
  P("Anything else?", []),
  E("Check it.", []),
  P("How about the other one?", []),
  P("Do you have pets?", []),
  P("What do you do for work?", []),
];

/** Frozen before the round-2 repair and never used to tune. New words for the same meanings, the
 * round-2 error types, context shifts, ambiguity, and requests that must still be answered. */
const HELD_OUT_2: Probe[] = [
  E("Look at it.", []),
  E("Can you test this one?", []),
  P("What else?", []),
  E("Examine it for me.", []),
  E("Get a film of the root end.", ["pa"], { answers: [/\b(?:periapical|radiograph)\b/i] }),
  E("Image the apex of that tooth.", ["pa"], { answers: [/\b(?:periapical|radiograph)\b/i] }),
  P("Do you use snuff or dip?", ["tobacco"], { answers: [/\btobacco\b/i] }),
  P("Any chewing tobacco?", ["tobacco"], { answers: [/\btobacco\b/i] }),
  P("Do you mostly chew on your left these days?", ["chewing-avoidance"], { answers: [CHEW_CHANGE] }),
  P("Which side do you eat on now?", ["chewing-avoidance"], { answers: [CHEW_CHANGE] }),
  P("Are you protecting that side when you eat?", ["chewing-avoidance"], { answers: [CHEW_CHANGE] }),
  P("Does biting into an apple hurt?", ["chewing"], { answers: [/\bhard food\b/i] }),
  P("Is it sore when you chew gum?", ["chewing"], { answers: [/\beat\b/i] }),
  P("Does iced tea set it off?", ["cold"], { accept: ["sweets"], answers: [COLD],
    note: "Iced tea may be sweetened, so sweets is a reasonable addition." }),
  P("What about warm soup?", ["heat"], { answers: [HOT] }),
  P("How long does that last?", ["cold"], { after: [p("Does cold bother it?")], answers: [COLD, BRIEF] }),
  P("And sweet things?", ["sweets"], { after: [p("Do cold drinks bother it?")], answers: [/\bsweets?\b/i] }),
  E("Do the same on the neighbouring tooth.", ["adjacent-teeth"], { after: [e("Percuss the tooth.")], answers: [/\badjacent\b/i] }),
  E("What about its edges?", ["margins"], { after: [e("Is there a filling in that tooth?")], answers: [/\bmargins?\b/i] }),
  P("Is there anything wrong with your general health?", ["medical-history"], { answers: [HEALTH] }),
  P("Any reactions to penicillin?", ["allergies"], { answers: [/\ballergies\b/i] }),
  E("Feel the tissue over the roots.", ["palpation"], { answers: [/\bpalpation\b/i] }),
  E("How firm is it in the socket?", ["mobility"], { answers: [/\bmobility\b/i] }),
  P("Do you like music?", []),
  P("Where do you live?", []),
];

const SUITES: Record<string, Probe[]> = {
  "tuning-1": TUNING_1, "held-out-1": HELD_OUT_1, "held-out-2": HELD_OUT_2,
  // Round 1 called the first two sets by these names.
  tuning: TUNING_1, "held-out": HELD_OUT_1, all: [...TUNING_1, ...HELD_OUT_1, ...HELD_OUT_2],
};
const setOf = (t: Probe) => HELD_OUT_2.includes(t) ? "held-out-2" : HELD_OUT_1.includes(t) ? "held-out-1" : "tuning-1";
const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const version = arg("--version");
const patient = [...discoveryPatients].reverse().find(x => x.caseId === "drchi-001" && (!version || x.version === version));
if (!patient) throw new Error(`unknown Case 001 pack: ${version}`);

type Context = { question: string; channel: DiscoveryChannel; factIds: string[] }[];
const ask = (t: Turn, ctx: Context, useModel: boolean) => respondToDiscovery(t.question, t.channel, patient!, ctx, { allowModel: useModel });
const short = (ids: string[]) => ids.map(id => id.slice(patient!.caseId.length + 1));

function score(t: Probe, actual: string[], text: string) {
  const allowed = [...t.expect, ...(t.accept ?? [])];
  const extra = actual.filter(id => !allowed.includes(id));
  const missing = t.expect.filter(id => !actual.includes(id));
  const answerFailures = t.expect.length ? (t.answers ?? []).filter(re => !re.test(text)).map(re => re.source) : actual.length ? ["disclosed instead of asking to clarify"] : [];
  return { accepted: t.accept ?? [], extra, missing, answersQuestion: !answerFailures.length, answerFailures,
    disclosureCorrect: !extra.length && !missing.length, correct: !extra.length && !missing.length && !answerFailures.length };
}

type Row = ReturnType<typeof score> & { suite: string; question: string; channel: DiscoveryChannel; after: string[]; expected: string[];
  rules?: string[]; actual: string[]; method: string; fallback: string | null; resolution?: string; ms: number; note?: string; text?: string };

function tally(rs: Row[]) {
  return { total: rs.length, correct: rs.filter(r => r.correct).length, disclosureCorrect: rs.filter(r => r.disclosureCorrect).length,
    answersQuestion: rs.filter(r => r.answersQuestion).length,
    withExtraDisclosure: rs.filter(r => r.extra.length).length, extraFacts: rs.reduce((n, r) => n + r.extra.length, 0),
    withMissing: rs.filter(r => r.missing.length).length, localModel: rs.filter(r => r.method === "local-model").length,
    fallbacks: rs.filter(r => r.fallback).length, maxMs: Math.max(0, ...rs.map(r => r.ms)) };
}
const summarize = (model: string | undefined, rows: Row[], extra: object = {}) => ({ model, pack: patient!.version, ...extra,
  ...Object.fromEntries(["tuning-1", "held-out-1", "held-out-2"].map(s => [s, rows.filter(r => r.suite === s)]).filter(([, rs]) => rs.length)
    .map(([s, rs]) => [s, tally(rs as Row[])])) });

/** Re-score preserved measurements with the current expectations and answer checks. The reply text is
 * rebuilt from the measured fact IDs, which is exact for the pack the measurement used. */
function rescore(file: string) {
  const measured = JSON.parse(readFileSync(file, "utf8")) as { summary: { model: string; pack: string }; rows: (Row & { correct: boolean })[] };
  if (measured.summary.pack !== patient!.version) throw new Error(`pack mismatch: ${measured.summary.pack}`);
  const probes = [...TUNING_1, ...HELD_OUT_1];
  const rows = measured.rows.map(m => {
    const t = probes.find(x => x.question === m.question && x.channel === m.channel && (x.after ?? []).map(a => a.question).join("|") === m.after.join("|"));
    if (!t) throw new Error(`no probe for: ${m.question}`);
    const facts = patient!.facts.filter(f => m.actual.includes(short([f.id])[0]!));
    const text = facts.map(f => f.answer).join("\n\n");
    return { ...m, suite: setOf(t), expected: t.expect, ...score(t, m.actual, text), note: t.note, originalCorrect: m.correct };
  });
  return { summary: summarize(measured.summary.model, rows, { rescoredFrom: file, original: measured.summary }), rows };
}

async function timed(t: Turn, ctx: Context) {
  const t0 = performance.now();
  const reply = await ask(t, ctx, true);
  return { reply, ms: Math.round(performance.now() - t0) };
}

async function main() {
  const out = arg("--json");
  const rescoreFile = arg("--rescore");
  if (rescoreFile) {
    const result = rescore(rescoreFile);
    console.log(JSON.stringify(result.summary));
    if (out) writeFileSync(out, JSON.stringify(result, null, 2));
    return;
  }
  const suiteName = arg("--suite") ?? "all";
  const probes = SUITES[suiteName];
  if (!probes) throw new Error(`unknown suite: ${suiteName}`);
  const model = process.env.CLINICAL_DISCOVERY_LLM_MODEL;
  if (!process.env.CLINICAL_DISCOVERY_LLM_BASE_URL || !model) throw new Error("CLINICAL_DISCOVERY_LLM_BASE_URL and CLINICAL_DISCOVERY_LLM_MODEL are required");
  const bench = arg("--bench");
  if (bench) {
    const cold = await timed(probes[0]!, []);
    const warm: number[] = [];
    const outcomes: string[] = [];
    for (let i = 0; i < Number(bench); i++) {
      const r = await timed(probes[i % probes.length]!, []);
      warm.push(r.ms);
      outcomes.push(r.reply.routing.fallback ?? r.reply.routing.method);
    }
    warm.sort((a, b) => a - b);
    console.log(JSON.stringify({ model, coldMs: cold.ms, coldMethod: cold.reply.routing.method, coldFallback: cold.reply.routing.fallback ?? null,
      warmMs: warm, warmMedianMs: warm[Math.floor(warm.length / 2)], warmMaxMs: warm.at(-1), warmOutcomes: outcomes }));
    return;
  }
  const showText = process.argv.includes("--show-text");
  // Recorded so a run can be checked afterwards against other clients of the same model server.
  const startedAt = new Date().toISOString();
  const rows: Row[] = [];
  for (const t of probes) {
    // A follow-up's context is what the router itself (with the model) recorded for the earlier request.
    const ctx: Context = [];
    for (const a of t.after ?? []) ctx.push({ ...a, factIds: (await ask(a, [...ctx], true)).factIds });
    const rules = await ask(t, ctx, false);
    const { reply, ms } = await timed(t, ctx);
    const actual = short(reply.factIds);
    const s = score(t, actual, reply.text);
    rows.push({ suite: setOf(t), question: t.question, channel: t.channel, after: (t.after ?? []).map(a => a.question), expected: t.expect,
      rules: short(rules.factIds), actual, ...s, method: reply.routing.method, fallback: reply.routing.fallback ?? null,
      resolution: reply.resolution, ms, ...(t.note ? { note: t.note } : {}), ...(showText ? { text: reply.text } : {}) });
    console.log([t.channel.padEnd(7), `${ms}ms`.padStart(7), reply.routing.method.padEnd(14), (reply.routing.fallback ?? "-").padEnd(30),
      `exp=[${t.expect.join(",")}]`.padEnd(30), `got=[${actual.join(",")}]`.padEnd(32),
      s.correct ? "OK    " : s.extra.length ? "EXTRA " : s.missing.length ? "MISS  " : "ANSWER", t.question].join(" "));
    if (showText) console.log(`        ${reply.text.replace(/\s+/g, " ")}`);
  }
  const summary = summarize(model, rows, { suite: suiteName, startedAt, finishedAt: new Date().toISOString() });
  console.log(JSON.stringify(summary));
  if (out) writeFileSync(out, JSON.stringify({ summary, rows }, null, 2));
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
