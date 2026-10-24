#!/usr/bin/env npx tsx
/**
 * CLINICAL DISCOVERY — local-model probe (operator-run, read-only).
 *
 * Calls the production router (`respondToDiscovery`) directly, with no database, session or trace.
 * Each request runs twice: authored rules only (model unset), then with the configured model, so a
 * paraphrase the rules cannot interpret is visible next to what the model selected.
 *
 *   CLINICAL_DISCOVERY_LLM_BASE_URL=… CLINICAL_DISCOVERY_LLM_MODEL=… [CLINICAL_DISCOVERY_LLM_KEY=…] \
 *     npx tsx scripts/clinical-discovery-model-probe.ts [--case drchi-001] [--version <pack>] [--json out.json] [--bench N]
 *
 * --bench N  latency only: one cold call, then N timed calls, against the same request.
 * Prints fact IDs and routing only — never fact answers. The key is never printed.
 */
import { writeFileSync } from "node:fs";
import { respondToDiscovery } from "@/lib/bty/clinical-pilot/discovery-router.server";
import { discoveryPatients } from "@/lib/bty/clinical-pilot/discovery-cases.server";
import type { DiscoveryChannel, DiscoveryReply } from "@/domain/clinical-pilot/discovery";

type Probe = { question: string; channel: DiscoveryChannel; after?: { question: string; channel: DiscoveryChannel }[]; expect: string[] };

/** Case 001 requests (written against the latest pack, variant B). `expect` lists the fact-ID suffixes a correct interpretation selects ([] = none). */
const CASE001: Probe[] = [
  // Paraphrases outside the authored patterns.
  { question: "Does anything you drink make it twinge?", channel: "patient", expect: ["cold"] },
  { question: "Does it ever ache while you're sleeping?", channel: "patient", expect: ["night"] },
  { question: "Does it act up all by itself, even when you're not eating?", channel: "patient", expect: ["spontaneous"] },
  { question: "Are you on any drugs your doctor gave you?", channel: "patient", expect: ["medications"] },
  { question: "Any illnesses I should know about?", channel: "patient", expect: ["medical-history"] },
  { question: "Has anyone ever said you gnash your teeth?", channel: "patient", expect: ["bruxism"] },
  { question: "Let me knock on the tooth with the mirror handle.", channel: "exam", expect: ["percussion"] },
  { question: "Shine a light through the tooth.", channel: "exam", expect: ["transillumination"] },
  { question: "Measure the gum depth around it.", channel: "exam", expect: ["probing"] },
  { question: "Take a picture of the root tip.", channel: "exam", expect: ["pa"] },
  { question: "Put some ice on the tooth and see how it reacts.", channel: "exam", expect: ["cold-test"] },
  // Follow-ups whose meaning depends on the previous request.
  { question: "How long ago was it put in?", channel: "patient", after: [{ question: "Is there a filling in that tooth?", channel: "exam" }], expect: ["restoration-age"] },
  { question: "Does it hang around afterwards?", channel: "patient", after: [{ question: "Does cold bother it?", channel: "patient" }], expect: ["cold"] },
  { question: "What about at night?", channel: "patient", after: [{ question: "Does it hurt when you chew?", channel: "patient" }], expect: ["night"] },
  // Paraphrases of variant B additions.
  { question: "How bad is it, from one to ten?", channel: "patient", expect: ["pain-severity"] },
  { question: "Have you changed how you eat because of it?", channel: "patient", expect: ["chewing-avoidance"] },
  { question: "Do you light up at all?", channel: "patient", expect: ["tobacco"] },
  { question: "How often do you get your teeth cleaned?", channel: "patient", expect: ["last-visit"] },
  { question: "Check whether it wobbles.", channel: "exam", expect: ["mobility"] },
  { question: "Use the pulp tester on it.", channel: "exam", expect: ["ept"] },
  { question: "Press along the gum beside the roots.", channel: "exam", expect: ["palpation"] },
  { question: "Compare with the same tooth on the other side.", channel: "exam", expect: ["adjacent-teeth"] },
  // Deliberately unavailable in the pack: selected, but answered as case information.
  { question: "Can we get a 3-D scan of the area?", channel: "exam", expect: ["cbct"] },
  // Must select nothing.
  { question: "What is their blood pressure?", channel: "exam", expect: [] },
  { question: "What's the weather like?", channel: "patient", expect: [] },
  { question: "Which test should I do next?", channel: "exam", expect: [] },
];

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const caseId = arg("--case") ?? "drchi-001";
const version = arg("--version");
const patient = [...discoveryPatients].reverse().find(p => p.caseId === caseId && (!version || p.version === version));
if (!patient) throw new Error(`unknown case/version: ${caseId} ${version ?? "(latest)"}`);
const model = process.env.CLINICAL_DISCOVERY_LLM_MODEL;
if (!process.env.CLINICAL_DISCOVERY_LLM_BASE_URL || !model) throw new Error("CLINICAL_DISCOVERY_LLM_BASE_URL and CLINICAL_DISCOVERY_LLM_MODEL are required");

const MODEL_ENV = ["CLINICAL_DISCOVERY_LLM_BASE_URL", "CLINICAL_DISCOVERY_LLM_MODEL", "CLINICAL_DISCOVERY_LLM_KEY"] as const;
const saved = Object.fromEntries(MODEL_ENV.map(k => [k, process.env[k]]));
async function rulesOnly<T>(fn: () => Promise<T>) {
  for (const k of MODEL_ENV) delete process.env[k];
  try { return await fn(); } finally { for (const k of MODEL_ENV) if (saved[k] !== undefined) process.env[k] = saved[k]; }
}
const short = (ids: string[]) => ids.map(id => id.slice(caseId.length + 1));
const context = (p: Probe, reply?: DiscoveryReply[]) => (p.after ?? []).map((a, i) => ({ ...a, factIds: reply?.[i]?.factIds ?? [] }));

async function timed(p: Probe, ctx: ReturnType<typeof context>) {
  const t0 = performance.now();
  const reply = await respondToDiscovery(p.question, p.channel, patient!, ctx);
  return { reply, ms: Math.round(performance.now() - t0) };
}

async function main() {
  const bench = arg("--bench");
  if (bench) {
    const p = CASE001[0]!;
    const cold = await timed(p, []);
    const warm: number[] = [];
    const outcomes: string[] = [];
    for (let i = 0; i < Number(bench); i++) {
      const r = await timed(CASE001[i % CASE001.length]!, []);
      warm.push(r.ms);
      outcomes.push(r.reply.routing.fallback ?? r.reply.routing.method);
    }
    warm.sort((a, b) => a - b);
    console.log(JSON.stringify({ model, coldMs: cold.ms, coldMethod: cold.reply.routing.method, coldFallback: cold.reply.routing.fallback ?? null,
      warmMs: warm, warmMedianMs: warm[Math.floor(warm.length / 2)], warmMaxMs: warm.at(-1), warmOutcomes: outcomes }));
    return;
  }
  const rows = [];
  for (const p of CASE001) {
    // A follow-up's context is what the router itself recorded for the earlier request.
    const earlier: DiscoveryReply[] = [];
    for (const a of p.after ?? []) earlier.push(await respondToDiscovery(a.question, a.channel, patient!, []));
    const ctx = context(p, earlier);
    const rules = await rulesOnly(() => respondToDiscovery(p.question, p.channel, patient!, ctx));
    const { reply, ms } = await timed(p, ctx);
    const selected = short(reply.factIds);
    const correct = selected.length === p.expect.length && p.expect.every(id => selected.includes(id));
    rows.push({ question: p.question, channel: p.channel, after: p.after?.map(a => a.question) ?? [], expect: p.expect,
      rules: { resolution: rules.resolution, factIds: short(rules.factIds) },
      model: { ms, method: reply.routing.method, version: reply.routing.version, fallback: reply.routing.fallback ?? null,
        resolution: reply.resolution, factIds: selected }, correct });
    console.log([p.channel.padEnd(7), `${ms}ms`.padStart(7), reply.routing.method.padEnd(14), (reply.routing.fallback ?? "-").padEnd(28),
      `rules=[${short(rules.factIds).join(",")}]`.padEnd(26), `model=[${selected.join(",")}]`.padEnd(30), correct ? "OK " : "BAD", p.question].join(" "));
  }
  const s = { model, pack: patient!.version, total: rows.length, localModel: rows.filter(r => r.model.method === "local-model").length,
    fallbacks: rows.filter(r => r.model.fallback).length, correct: rows.filter(r => r.correct).length,
    rulesMissedButModelCorrect: rows.filter(r => r.correct && r.expect.length && !r.rules.factIds.length).length,
    maxMs: Math.max(...rows.map(r => r.model.ms)) };
  console.log(JSON.stringify(s));
  const out = arg("--json");
  if (out) writeFileSync(out, JSON.stringify({ summary: s, rows }, null, 2));
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
