#!/usr/bin/env npx tsx
/**
 * CLINICAL DISCOVERY — local-model probe (operator-run, read-only).
 *
 * Calls the production router (`respondToDiscovery`) directly, with no database, session or trace.
 * Each request runs twice: authored rules only (allowModel false), then with the model, so a
 * paraphrase the rules cannot interpret is visible next to what the model selected.
 *
 *   CLINICAL_DISCOVERY_LLM_BASE_URL=… CLINICAL_DISCOVERY_LLM_MODEL=… [CLINICAL_DISCOVERY_LLM_KEY=…] \
 *     npx tsx scripts/clinical-discovery-model-probe.ts [--suite tuning|held-out|all] [--version <pack>] [--json out.json] [--bench N]
 *
 * `expect` is the set of fact-ID suffixes a correct interpretation discloses; [] means nothing may be
 * disclosed (the doctor is asked to clarify). Extra = disclosed but not asked; missing = asked but not
 * disclosed. Prints fact IDs and routing only — never fact answers. The key is never printed.
 *
 * HELD_OUT was written before any repair and is never used to tune patterns, labels or the prompt.
 */
import { writeFileSync } from "node:fs";
import { respondToDiscovery } from "@/lib/bty/clinical-pilot/discovery-router.server";
import { discoveryPatients } from "@/lib/bty/clinical-pilot/discovery-cases.server";
import type { DiscoveryChannel } from "@/domain/clinical-pilot/discovery";

type Turn = { question: string; channel: DiscoveryChannel };
type Probe = Turn & { after?: Turn[]; expect: string[] };
const P = (question: string, expect: string[], after?: Turn[]): Probe => ({ question, channel: "patient", expect, ...(after ? { after } : {}) });
const E = (question: string, expect: string[], after?: Turn[]): Probe => ({ question, channel: "exam", expect, ...(after ? { after } : {}) });
const p = (question: string): Turn => ({ question, channel: "patient" });
const e = (question: string): Turn => ({ question, channel: "exam" });

/** Case 001 variant B. Used while repairing: the first measured set plus same-meaning variants of each reported error. */
const TUNING: Probe[] = [
  P("Does anything you drink make it twinge?", ["cold", "heat"]),
  P("Does it ever ache while you're sleeping?", ["night"]),
  P("Does it act up all by itself, even when you're not eating?", ["spontaneous"]),
  P("Are you on any drugs your doctor gave you?", ["medications"]),
  P("Any illnesses I should know about?", ["medical-history"]),
  P("Has anyone ever said you gnash your teeth?", ["bruxism"]),
  E("Let me knock on the tooth with the mirror handle.", ["percussion"]),
  E("Shine a light through the tooth.", ["transillumination"]),
  E("Measure the gum depth around it.", ["probing"]),
  E("Take a picture of the root tip.", ["pa"]),
  E("Put some ice on the tooth and see how it reacts.", ["cold-test"]),
  P("How long ago was it put in?", ["restoration-age"], [e("Is there a filling in that tooth?")]),
  P("Does it hang around afterwards?", ["cold"], [p("Does cold bother it?")]),
  P("What about at night?", ["night"], [p("Does it hurt when you chew?")]),
  P("How bad is it, from one to ten?", ["pain-severity"]),
  P("Have you changed how you eat because of it?", ["chewing-avoidance"]),
  P("Do you light up at all?", ["tobacco"]),
  P("How often do you get your teeth cleaned?", ["last-visit"]),
  E("Check whether it wobbles.", ["mobility"]),
  E("Use the pulp tester on it.", ["ept"]),
  E("Press along the gum beside the roots.", ["palpation"]),
  E("Compare with the same tooth on the other side.", ["adjacent-teeth"]),
  E("Can we get a 3-D scan of the area?", ["cbct"]),
  E("What is their blood pressure?", []),
  P("What's the weather like?", []),
  E("Which test should I do next?", []),
  // Same-meaning variants of the reported errors.
  P("Do drinks bother it at all?", ["cold", "heat"]),
  P("Do you have any diseases?", ["medical-history"]),
  P("Does the feeling stay for a while?", ["cold"], [p("Is it sensitive to cold?")]),
  E("Check the tooth on the opposite side too.", ["adjacent-teeth"]),
  P("Does it hurt for no reason, without biting?", ["spontaneous"]),
  P("Has this changed the way you chew?", ["chewing-avoidance"]),
];

/** Written before the repair; never used to tune. Same meanings in new words, context shifts, ambiguity. */
const HELD_OUT: Probe[] = [
  P("Is it sensitive to iced water?", ["cold"]),
  P("Do hot or cold drinks set it off?", ["cold", "heat"]),
  P("Does a sip of coffee bother it?", ["heat"]),
  P("Have you been diagnosed with anything?", ["medical-history"]),
  P("Do you chew tobacco?", ["tobacco"]),
  P("Do you avoid eating on that side?", ["chewing-avoidance"]),
  P("Is the pain there when you're just sitting still?", ["spontaneous"]),
  P("Do you favour one side when chewing now?", ["chewing-avoidance"]),
  E("Check the teeth beside it.", ["adjacent-teeth"]),
  E("Test the opposite molar as a control.", ["adjacent-teeth"]),
  E("Check around its edges.", ["margins"], [e("Is there a filling in that tooth?")]),
  P("Does it linger?", ["cold"], [p("Does cold bother it?")]),
  P("And hot ones?", ["heat"], [p("Do cold drinks bother it?")]),
  P("When did it start this time?", ["symptom-duration"], [p("Have you had this before?")]),
  P("Does it bother you?", []),
  P("Anything else?", []),
  E("Check it.", []),
  P("How about the other one?", []),
  P("Do you have pets?", []),
  P("What do you do for work?", []),
];

const SUITES = { tuning: TUNING, "held-out": HELD_OUT, all: [...TUNING, ...HELD_OUT] } as const;
const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const suiteName = (arg("--suite") ?? "all") as keyof typeof SUITES;
const probes = SUITES[suiteName];
if (!probes) throw new Error(`unknown suite: ${suiteName}`);
const version = arg("--version");
const patient = [...discoveryPatients].reverse().find(x => x.caseId === "drchi-001" && (!version || x.version === version));
if (!patient) throw new Error(`unknown Case 001 pack: ${version}`);
const model = process.env.CLINICAL_DISCOVERY_LLM_MODEL;
if (!process.env.CLINICAL_DISCOVERY_LLM_BASE_URL || !model) throw new Error("CLINICAL_DISCOVERY_LLM_BASE_URL and CLINICAL_DISCOVERY_LLM_MODEL are required");

type Context = { question: string; channel: DiscoveryChannel; factIds: string[] }[];
const ask = (t: Turn, ctx: Context, useModel: boolean) => respondToDiscovery(t.question, t.channel, patient!, ctx, { allowModel: useModel });
const short = (ids: string[]) => ids.map(id => id.slice(patient!.caseId.length + 1));

async function timed(t: Turn, ctx: Context) {
  const t0 = performance.now();
  const reply = await ask(t, ctx, true);
  return { reply, ms: Math.round(performance.now() - t0) };
}

async function main() {
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
  const rows = [];
  for (const t of probes) {
    // A follow-up's context is what the router itself (with the model) recorded for the earlier request.
    const ctx: Context = [];
    for (const a of t.after ?? []) ctx.push({ ...a, factIds: (await ask(a, [...ctx], true)).factIds });
    const rules = await ask(t, ctx, false);
    const { reply, ms } = await timed(t, ctx);
    const actual = short(reply.factIds);
    const extra = actual.filter(id => !t.expect.includes(id));
    const missing = t.expect.filter(id => !actual.includes(id));
    rows.push({ suite: HELD_OUT.includes(t) ? "held-out" : "tuning", question: t.question, channel: t.channel,
      after: (t.after ?? []).map(a => a.question), expected: t.expect, rules: short(rules.factIds), actual, extra, missing,
      method: reply.routing.method, fallback: reply.routing.fallback ?? null, resolution: reply.resolution, ms, correct: !extra.length && !missing.length });
    console.log([t.channel.padEnd(7), `${ms}ms`.padStart(7), reply.routing.method.padEnd(14), (reply.routing.fallback ?? "-").padEnd(28),
      `exp=[${t.expect.join(",")}]`.padEnd(30), `got=[${actual.join(",")}]`.padEnd(30),
      !extra.length && !missing.length ? "OK   " : extra.length ? "EXTRA" : "MISS ", t.question].join(" "));
  }
  const tally = (rs: typeof rows) => ({ total: rs.length, correct: rs.filter(r => r.correct).length,
    withExtraDisclosure: rs.filter(r => r.extra.length).length, extraFacts: rs.reduce((n, r) => n + r.extra.length, 0),
    withMissing: rs.filter(r => r.missing.length).length, localModel: rs.filter(r => r.method === "local-model").length,
    fallbacks: rs.filter(r => r.fallback).length, maxMs: Math.max(0, ...rs.map(r => r.ms)) });
  const summary = { model, pack: patient!.version, suite: suiteName,
    tuning: tally(rows.filter(r => r.suite === "tuning")), heldOut: tally(rows.filter(r => r.suite === "held-out")) };
  console.log(JSON.stringify(summary));
  const out = arg("--json");
  if (out) writeFileSync(out, JSON.stringify({ summary, rows }, null, 2));
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
