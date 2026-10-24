import type { DiscoveryChannel } from "@/domain/clinical-pilot/discovery";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";

/** Connection diagnostic only: Worker → gateway → model, through the production router.
 * It answers "is the model reachable and returning valid selections?", NOT "are selections accurate".
 * Conversation accuracy is measured separately with scripts/clinical-discovery-model-probe.ts.
 * No database, session, trace or attempt is created; only fact IDs and routing are returned,
 * never patient answers or the key. The caller has already checked Founder access.
 */
type Probe = { question: string; channel: DiscoveryChannel; after?: { question: string; channel: DiscoveryChannel } };

const PROBES: Probe[] = [
  { question: "Use the pulp tester on it.", channel: "exam" },
  { question: "Are you on any drugs your doctor gave you?", channel: "patient" },
  { question: "How long ago was it put in?", channel: "patient", after: { question: "Is there a filling in that tooth?", channel: "exam" } },
  { question: "What's the weather like?", channel: "patient" },
];

/** Failures that prove the request never got a valid model answer. A low-confidence or mismatch
 * fallback means the model DID answer validly; the router declined the selection. */
const UNREACHED = new Set(["local_model_timeout", "local_model_unavailable", "local_model_http_error", "local_model_invalid_response",
  "local_model_invalid_selection", "local_model_not_configured", "local_model_invalid_configuration", "local_model_not_enabled"]);

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
  const config = modelCheckConfiguration();
  const results = [];
  for (const p of PROBES) {
    const context = [];
    if (p.after) {
      const earlier = await respondToDiscovery(p.after.question, p.after.channel, patient, [], { allowModel: true });
      context.push({ ...p.after, factIds: earlier.factIds });
    }
    const started = Date.now();
    const r = await respondToDiscovery(p.question, p.channel, patient, context, { allowModel: true });
    results.push({ question: p.question, channel: p.channel, after: p.after?.question ?? null, ms: Date.now() - started,
      method: r.routing.method, version: r.routing.version, fallback: r.routing.fallback ?? null, factIds: strip(r.factIds) });
  }
  const answered = results.filter(r => r.method === "local-model" || (r.fallback && !UNREACHED.has(r.fallback)));
  const connection = !config.configured ? "not_configured" : answered.length ? "reached" : "not_reached";
  return { scope: "connection-diagnostic", accuracyEvaluated: false, connection, validModelAnswers: answered.length,
    requests: results.length, pack: patient.version, ...config, results };
}
