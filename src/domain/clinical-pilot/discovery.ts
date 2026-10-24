import type { PilotEvent, PilotReference, PilotTrace } from "./pilot";
import { startPilot, type PilotCase } from "./pilot";

export const DISCOVERY_INTERACTION_VERSION = "clinical-discovery/v1" as const;
export type DiscoveryChannel = "patient" | "exam";
export type DiscoveryFact = { id: string; channel: DiscoveryChannel; topic: string; patterns: string[]; answer: string; available?: boolean; toothNumbers?: number[]; provenance?: "fictional-extension-awaiting-review" };
export type DiscoveryPatient = { caseId: string; version: string; chiefComplaint: string; facts: DiscoveryFact[] };
export type DiscoveryReply = {
  channel: DiscoveryChannel; text: string; factIds: string[]; availableFactIds: string[]; unavailableFactIds: string[];
  resolution: "answered" | "unavailable" | "clarify";
  routing: { method: "authored-rules" | "local-model"; version: string; fallback?: string };
  fictionalExtensionFactIds?: string[];
};
export const isDiscoveryTrace = (t: PilotTrace) => t.discovery?.interactionVersion === DISCOVERY_INTERACTION_VERSION;
export function startDiscoveryPilot(traceId: string, c: PilotCase, caseHash: string, requestId: string, at: string, prior: boolean, packVersion: string, priorContext = false): PilotTrace {
  const t = startPilot(traceId, c, caseHash, requestId, at, prior);
  return { ...t, discovery: { interactionVersion: DISCOVERY_INTERACTION_VERSION, packVersion,
    priorCaseContextExposure: priorContext ? "prior-written-case" : "not_recorded" },
    events: t.events.map(e => ({ ...e, payload: { ...e.payload, mode: "discovery", interactionVersion: DISCOVERY_INTERACTION_VERSION,
      packVersion, priorCaseContextExposure: priorContext ? "prior-written-case" : "not_recorded", externalCaseContextExposure: "unknown" } })) };
}
export function discoveryTurns(t: PilotTrace) {
  return t.events.filter(e => e.type === "discovery_turn").map(e => ({ sequence: e.sequence, at: e.at,
    channel: e.payload.channel as DiscoveryChannel, question: e.payload.question as string, reply: e.payload.reply as DiscoveryReply }));
}
export const initialAssessment = (t: PilotTrace): string | null => (t.events.find(e => e.type === "assessment_submitted")?.payload.text as string) ?? null;
export const latestAssessment = (t: PilotTrace): string => ([...t.events].reverse().find(e => e.type === "assessment_submitted" || e.type === "working_assessment")?.payload.text as string) ?? "";
export type DiscoveryAction = { operation: "message"; text: string; channel: DiscoveryChannel } | { operation: "decision" | "conclude"; text: string };

/** Before commitment, only issued replies enter the trace. Comparison context is released at conclusion. */
export function applyDiscoveryAction(t: PilotTrace, action: DiscoveryAction, requestId: string, at: string, reference: PilotReference, reply?: DiscoveryReply): PilotTrace {
  if (t.events.some(e => e.requestId === requestId)) return t;
  if (!isDiscoveryTrace(t)) throw Error("WRONG_FLOW");
  if (t.phase !== "draft") throw Error("IMMUTABLE");
  if (!action.text.trim()) throw Error("TEXT_REQUIRED");
  if (t.events.length >= 300 && action.operation !== "conclude") throw Error("ENCOUNTER_LIMIT");
  const turns = discoveryTurns(t);
  const availableFactIds = [...new Set(turns.flatMap(turn => turn.reply.availableFactIds))];
  const payload = action.operation === "message" ? { channel: action.channel, question: action.text, reply,
    informationBefore: availableFactIds, elapsedMs: Math.max(0, Date.parse(at) - Date.parse(t.events[0].at)) }
    : { text: action.text, informationAvailable: availableFactIds, turnCount: turns.length,
      elapsedMs: Math.max(0, Date.parse(at) - Date.parse(t.events[0].at)) };
  if (action.operation === "message" && (!reply || reply.channel !== action.channel)) throw Error("REPLY_REQUIRED");
  const type: PilotEvent["type"] = action.operation === "message" ? "discovery_turn" : action.operation === "conclude" ? "assessment_submitted" : "working_assessment";
  const events: PilotEvent[] = [...t.events, { sequence: t.events.length + 1, requestId, type, at, payload }];
  if (action.operation === "conclude") events.push({ sequence: events.length + 1, requestId, type: "reference_released", at, payload: { reference } });
  return { ...t, events, phase: action.operation === "conclude" ? "submitted" : "draft" };
}
