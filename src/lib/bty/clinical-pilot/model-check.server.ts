import type { DiscoveryChannel } from "@/domain/clinical-pilot/discovery";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";

/** Admin-only connection check: Worker → gateway → model, through the production router.
 * No database, session, trace or attempt is created; only fact IDs and routing are returned,
 * never patient answers. A wrong selection here is simulator behaviour, not a doctor's result.
 */
type Probe = { question: string; channel: DiscoveryChannel; after?: { question: string; channel: DiscoveryChannel }; expect: string[] };

const PROBES: Probe[] = [
  { question: "Use the pulp tester on it.", channel: "exam", expect: ["ept"] },
  { question: "Are you on any drugs your doctor gave you?", channel: "patient", expect: ["medications"] },
  { question: "How long ago was it put in?", channel: "patient", after: { question: "Is there a filling in that tooth?", channel: "exam" }, expect: ["restoration-age"] },
  { question: "What's the weather like?", channel: "patient", expect: [] },
];

export function modelCheckConfiguration() {
  const base = process.env.CLINICAL_DISCOVERY_LLM_BASE_URL?.trim();
  let host: string | null = null;
  try { host = base ? new URL(base).host : null; } catch { host = "invalid"; }
  return { configured: !!base && !!process.env.CLINICAL_DISCOVERY_LLM_MODEL?.trim(), host,
    model: process.env.CLINICAL_DISCOVERY_LLM_MODEL?.trim() || null, keyConfigured: !!process.env.CLINICAL_DISCOVERY_LLM_KEY?.trim() };
}

export async function checkDiscoveryModel() {
  const patient = [...discoveryPatients].reverse().find(p => p.caseId === "drchi-001")!;
  const strip = (ids: string[]) => ids.map(id => id.slice(patient.caseId.length + 1));
  const results = [];
  for (const p of PROBES) {
    const context = [];
    if (p.after) {
      const earlier = await respondToDiscovery(p.after.question, p.after.channel, patient, []);
      context.push({ ...p.after, factIds: earlier.factIds });
    }
    const started = Date.now();
    const r = await respondToDiscovery(p.question, p.channel, patient, context);
    const factIds = strip(r.factIds);
    results.push({ question: p.question, channel: p.channel, after: p.after?.question ?? null, ms: Date.now() - started,
      method: r.routing.method, version: r.routing.version, fallback: r.routing.fallback ?? null, resolution: r.resolution,
      factIds, expected: p.expect, matchesExpected: factIds.length === p.expect.length && p.expect.every(id => factIds.includes(id)) });
  }
  return { pack: patient.version, ...modelCheckConfiguration(), results,
    // A probe that legitimately selects nothing may still fall back (e.g. low confidence).
    localModelReached: results.some(r => r.method === "local-model") };
}
