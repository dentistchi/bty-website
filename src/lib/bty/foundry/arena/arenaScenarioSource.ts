import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModuleSnapshot } from "@/domain/foundry/module/module-publish";
import { normalizeLearningNeeds, type AudienceType, type LearningNeed } from "@/domain/foundry/module/module-builder";
import { deriveAvoidanceSeeds } from "@/domain/foundry/arena-draft/guided";
import { HARDEST_WHEN_OPTIONS, type AvoidancePressureSeed, type HardestWhenOption } from "@/domain/foundry/arena-draft/types";

/**
 * Foundry Guided Arena Builder — source-module resolution (service).
 *
 * Resolves the EXACT immutable module version a host may build Arena practice
 * from: a published `foundry_events` row the caller OWNS, plus its frozen
 * `foundry_event_module` snapshot. Ownership is proven here (the event's
 * owner_user_id must equal the caller) before any private module detail is read —
 * this is the server-side authorization for reading source-derived content.
 *
 * The returned summary is plain product language only: no internal ids, no
 * architecture jargon. The raw snapshot is carried for generation grounding but is
 * never sent to the client as-is.
 */

export type ModuleSourceFacts = {
  problem: string | null;
  observableBehavior: string | null;
  successEvidence: string | null;
  audienceType: AudienceType | null;
  audienceDetail: string | null;
  learningNeeds: LearningNeed[];
};

export type ArenaSourceSummary = {
  eventId: string;
  sourceDraftId: string;
  moduleVersion: number;
  eventTitle: string;
  eventStatus: "open" | "closed";
  arenaRecommended: boolean;
  facts: ModuleSourceFacts;
  /** Guided-question suggestion KEYS (UI localizes). */
  hardestWhenOptions: readonly HardestWhenOption[];
  avoidanceSeeds: AvoidancePressureSeed[];
};

export type SourceResult =
  | { ok: true; value: ArenaSourceSummary }
  | { ok: false; reason: "source_not_found" | "source_not_owned" | "source_no_module" };

type EventRow = { id: string; owner_user_id: string; title: string; status: string };
type ModuleRow = { source_draft_id: string; module_snapshot: ModuleSnapshot; module_version: number };

/** Pull the grounding facts out of the frozen snapshot (whitelist fields only). */
export function moduleFactsFromSnapshot(snapshot: ModuleSnapshot | undefined): ModuleSourceFacts {
  const s = snapshot ?? {};
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null);
  return {
    problem: str(s.problem),
    observableBehavior: str(s.observableBehavior),
    successEvidence: str(s.successEvidence),
    audienceType: (s.audienceType as AudienceType | undefined) ?? null,
    audienceDetail: str(s.audienceDetail),
    learningNeeds: normalizeLearningNeeds(s),
  };
}

/**
 * Resolve the source module for a host + event id. Returns an honest failure when
 * the event is missing (source_not_found), owned by someone else (source_not_owned
 * — indistinguishable from missing at the route), or has no published module
 * snapshot yet (source_no_module). Never discloses another owner's event.
 */
export async function resolveArenaSource(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<SourceResult> {
  const { data: event } = await admin
    .from("foundry_events")
    .select("id, owner_user_id, title, status")
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (!event) return { ok: false, reason: "source_not_found" };
  if (event.owner_user_id !== ownerUserId) return { ok: false, reason: "source_not_owned" };

  const { data: module } = await admin
    .from("foundry_event_module")
    .select("source_draft_id, module_snapshot, module_version")
    .eq("event_id", eventId)
    .maybeSingle<ModuleRow>();
  if (!module) return { ok: false, reason: "source_no_module" };

  const facts = moduleFactsFromSnapshot(module.module_snapshot);
  const arenaRecommended = module.module_snapshot?.arenaRecommended === true;

  return {
    ok: true,
    value: {
      eventId: event.id,
      sourceDraftId: module.source_draft_id,
      moduleVersion: module.module_version,
      eventTitle: event.title,
      eventStatus: event.status === "open" ? "open" : "closed",
      arenaRecommended,
      facts,
      hardestWhenOptions: HARDEST_WHEN_OPTIONS,
      avoidanceSeeds: deriveAvoidanceSeeds(module.module_snapshot),
    },
  };
}
