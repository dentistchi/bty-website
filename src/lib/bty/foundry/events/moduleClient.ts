import type { ModuleDraftRow, ModuleDraftSummary } from "./foundryModuleService";
import type { ModuleDraftStatus } from "@/domain/foundry/module/module-draft";
import { normalizeLearningNeeds, type BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * Client-facing draft serialization for the Guided Module Builder routes.
 *
 * The builder never receives owner_user_id, and never the opaque
 * document_asset_ref VALUE (only whether one is present) — in this slice a PDF is
 * an intent, not a durable asset, and no storage path is ever exposed. This is the
 * single place the API's draft shape is defined, so a route can't accidentally leak
 * an internal field.
 */
export type ClientDraft = {
  id: string;
  status: ModuleDraftStatus;
  current_step: number;
  answers: BuilderAnswers;
  module_version: number;
  parent_module_id: string | null;
  document_asset_ref_present: boolean;
  created_at: string;
  updated_at: string;
};

/** The list-item shape — a summary already free of owner id and answers. */
export type ClientDraftSummary = ModuleDraftSummary;

export function toClientDraft(row: ModuleDraftRow): ClientDraft {
  const answers = (row.answers ?? {}) as BuilderAnswers;
  // Restore old drafts into the canonical multi-select shape (legacy learningNeed
  // -> learningNeeds[]) so the client never has to know about the legacy field.
  const needs = normalizeLearningNeeds(answers);
  const normalized: BuilderAnswers = needs.length > 0 ? { ...answers, learningNeeds: needs } : answers;
  return {
    id: row.id,
    status: row.status,
    current_step: row.current_step,
    answers: normalized,
    module_version: row.module_version,
    parent_module_id: row.parent_module_id,
    document_asset_ref_present: row.document_asset_ref != null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Summaries are already safe; this is the explicit, named projection the routes use. */
export function toClientSummary(s: ModuleDraftSummary): ClientDraftSummary {
  return {
    id: s.id,
    status: s.status,
    current_step: s.current_step,
    module_version: s.module_version,
    title: s.title ?? null,
    updated_at: s.updated_at,
    created_at: s.created_at,
  };
}
