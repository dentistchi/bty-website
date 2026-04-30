import type {
  ActionChoiceId,
  BaseChoiceMapping,
  BaseScenario,
  EscalationBranch,
  Locale,
  LocalizedScenario,
  PrimaryChoiceId,
  RuntimeFlowContext,
  RuntimeScenario,
  ScenarioDecisionEvent,
  SecondChoiceId,
} from "./types";
export type { RuntimeFlowContext } from "./types";

import incident01Core01BaseRaw from "./core_01_training_system_exposure/base.json";
import incident01Core01EnRaw from "./core_01_training_system_exposure/en.json";
import incident01Core01KoRaw from "./core_01_training_system_exposure/ko.json";
import incident01Core02BaseRaw from "./core_02_new_doctor_reexposure_compromise_loop/base.json";
import incident01Core02EnRaw from "./core_02_new_doctor_reexposure_compromise_loop/en.json";
import incident01Core02KoRaw from "./core_02_new_doctor_reexposure_compromise_loop/ko.json";
import incident01Core03BaseRaw from "./core_03_training_failure_hidden_as_performance_issue/base.json";
import incident01Core03EnRaw from "./core_03_training_failure_hidden_as_performance_issue/en.json";
import incident01Core03KoRaw from "./core_03_training_failure_hidden_as_performance_issue/ko.json";
import incident01Core04BaseRaw from "./core_04_manager_neutrality_as_abandonment/base.json";
import incident01Core04EnRaw from "./core_04_manager_neutrality_as_abandonment/en.json";
import incident01Core04KoRaw from "./core_04_manager_neutrality_as_abandonment/ko.json";
import incident01Core05BaseRaw from "./core_05_resignation_signal/base.json";
import incident01Core05EnRaw from "./core_05_resignation_signal/en.json";
import incident01Core05KoRaw from "./core_05_resignation_signal/ko.json";
import incident01Core06BaseRaw from "./core_06_external_exposure/base.json";
import incident01Core06EnRaw from "./core_06_external_exposure/en.json";
import incident01Core06KoRaw from "./core_06_external_exposure/ko.json";
import incident01Core07BaseRaw from "./core_07_repair_conversation/base.json";
import incident01Core07EnRaw from "./core_07_repair_conversation/en.json";
import incident01Core07KoRaw from "./core_07_repair_conversation/ko.json";
import incident01Core08BaseRaw from "./core_08_doctor_repair/base.json";
import incident01Core08EnRaw from "./core_08_doctor_repair/en.json";
import incident01Core08KoRaw from "./core_08_doctor_repair/ko.json";
import incident01Core09BaseRaw from "./core_09_identity_shift/base.json";
import incident01Core09EnRaw from "./core_09_identity_shift/en.json";
import incident01Core09KoRaw from "./core_09_identity_shift/ko.json";
import incident02Core01BaseRaw from "./core_10_integrity_favoritism_signal/base.json";
import incident02Core01EnRaw from "./core_10_integrity_favoritism_signal/en.json";
import incident02Core01KoRaw from "./core_10_integrity_favoritism_signal/ko.json";
import incident02Core02BaseRaw from "./core_11_selective_standard_escalation/base.json";
import incident02Core02EnRaw from "./core_11_selective_standard_escalation/en.json";
import incident02Core02KoRaw from "./core_11_selective_standard_escalation/ko.json";
import incident02Core03BaseRaw from "./core_12_silence_normalization/base.json";
import incident02Core03EnRaw from "./core_12_silence_normalization/en.json";
import incident02Core03KoRaw from "./core_12_silence_normalization/ko.json";
import incident02Core04BaseRaw from "./core_13_assistant_adaptation/base.json";
import incident02Core04EnRaw from "./core_13_assistant_adaptation/en.json";
import incident02Core04KoRaw from "./core_13_assistant_adaptation/ko.json";
import incident02Core05BaseRaw from "./core_14_manager_awareness_gap/base.json";
import incident02Core05EnRaw from "./core_14_manager_awareness_gap/en.json";
import incident02Core05KoRaw from "./core_14_manager_awareness_gap/ko.json";
import incident02Core06BaseRaw from "./core_15_system_exposure/base.json";
import incident02Core06EnRaw from "./core_15_system_exposure/en.json";
import incident02Core06KoRaw from "./core_15_system_exposure/ko.json";
import incident02Core07BaseRaw from "./core_16_repair_standard_reset/base.json";
import incident02Core07EnRaw from "./core_16_repair_standard_reset/en.json";
import incident02Core07KoRaw from "./core_16_repair_standard_reset/ko.json";
import incident02Core08BaseRaw from "./core_17_lead_assistant_repair/base.json";
import incident02Core08EnRaw from "./core_17_lead_assistant_repair/en.json";
import incident02Core08KoRaw from "./core_17_lead_assistant_repair/ko.json";
import incident02Core09BaseRaw from "./core_18_identity_integrity_choice/base.json";
import incident02Core09EnRaw from "./core_18_identity_integrity_choice/en.json";
import incident02Core09KoRaw from "./core_18_identity_integrity_choice/ko.json";
import incident03Core01BaseRaw from "./core_19_authority_signal/base.json";
import incident03Core01EnRaw from "./core_19_authority_signal/en.json";
import incident03Core01KoRaw from "./core_19_authority_signal/ko.json";
import incident03Core02BaseRaw from "./core_20_unquestioned_decision/base.json";
import incident03Core02EnRaw from "./core_20_unquestioned_decision/en.json";
import incident03Core02KoRaw from "./core_20_unquestioned_decision/ko.json";
import incident03Core03BaseRaw from "./core_21_silence_under_hierarchy/base.json";
import incident03Core03EnRaw from "./core_21_silence_under_hierarchy/en.json";
import incident03Core03KoRaw from "./core_21_silence_under_hierarchy/ko.json";
import incident03Core04BaseRaw from "./core_22_assistant_truth_block/base.json";
import incident03Core04EnRaw from "./core_22_assistant_truth_block/en.json";
import incident03Core04KoRaw from "./core_22_assistant_truth_block/ko.json";
import incident03Core05BaseRaw from "./core_23_manager_truth_block/base.json";
import incident03Core05EnRaw from "./core_23_manager_truth_block/en.json";
import incident03Core05KoRaw from "./core_23_manager_truth_block/ko.json";
import incident03Core06BaseRaw from "./core_24_external_truth_exposure/base.json";
import incident03Core06EnRaw from "./core_24_external_truth_exposure/en.json";
import incident03Core06KoRaw from "./core_24_external_truth_exposure/ko.json";
import incident03Core07BaseRaw from "./core_25_forced_repair_conversation/base.json";
import incident03Core07EnRaw from "./core_25_forced_repair_conversation/en.json";
import incident03Core07KoRaw from "./core_25_forced_repair_conversation/ko.json";
import incident03Core08BaseRaw from "./core_26_doctor_repair_choice/base.json";
import incident03Core08EnRaw from "./core_26_doctor_repair_choice/en.json";
import incident03Core08KoRaw from "./core_26_doctor_repair_choice/ko.json";
import incident03Core09BaseRaw from "./core_27_identity_repair_commitment/base.json";
import incident03Core09EnRaw from "./core_27_identity_repair_commitment/en.json";
import incident03Core09KoRaw from "./core_27_identity_repair_commitment/ko.json";

type RawEnvelope = Record<string, unknown>;
type RuntimeBundle = { base: unknown; en: unknown; ko: unknown };
type RuntimeScenarioNode = { base: BaseScenario; en: LocalizedScenario; ko: LocalizedScenario };
export type ScenarioBundle = RuntimeScenarioNode;
export interface IncidentBundle {
  incidentId: string;
  scenarios: ScenarioBundle[];
}
type IncidentCoreKey =
  | "core_01"
  | "core_02"
  | "core_03"
  | "core_04"
  | "core_05"
  | "core_06"
  | "core_07"
  | "core_08"
  | "core_09";

type IncidentRuntimeRegistry = Record<IncidentCoreKey, RuntimeScenarioNode>;
const scenarioValidationErrors = new Map<string, string>();

export const scenarioList = [
  "core_01_training_system_exposure",
  "core_02_new_doctor_reexposure_compromise_loop",
  "core_03_training_failure_hidden_as_performance_issue",
  "core_04_manager_neutrality_as_abandonment",
  "core_05_resignation_signal",
  "core_06_external_exposure",
  "core_07_repair_conversation",
  "core_08_doctor_repair",
  "core_09_identity_shift",
  "core_10_integrity_favoritism_signal",
  "core_11_selective_standard_escalation",
  "core_12_silence_normalization",
  "core_13_assistant_adaptation",
  "core_14_manager_awareness_gap",
  "core_15_system_exposure",
  "core_16_repair_standard_reset",
  "core_17_lead_assistant_repair",
  "core_18_identity_integrity_choice",
  "core_19_authority_signal",
  "core_20_unquestioned_decision",
  "core_21_silence_under_hierarchy",
  "core_22_assistant_truth_block",
  "core_23_manager_truth_block",
  "core_24_external_truth_exposure",
  "core_25_forced_repair_conversation",
  "core_26_doctor_repair_choice",
  "core_27_identity_repair_commitment",
] as const;

export type ScenarioId = (typeof scenarioList)[number];
export type IncidentId =
  | "incident_01_small_compromise_to_trust_repair"
  | "incident_02_authority_integrity_breakdown"
  | "incident_03_culture_adoption_toxic_environment_breakdown";

const scenarioFolderByScenarioId: Record<ScenarioId, string> = {
  core_01_training_system_exposure: "core_01_training_system_exposure",
  core_02_new_doctor_reexposure_compromise_loop: "core_02_new_doctor_reexposure_compromise_loop",
  core_03_training_failure_hidden_as_performance_issue: "core_03_training_failure_hidden_as_performance_issue",
  core_04_manager_neutrality_as_abandonment: "core_04_manager_neutrality_as_abandonment",
  core_05_resignation_signal: "core_05_resignation_signal",
  core_06_external_exposure: "core_06_external_exposure",
  core_07_repair_conversation: "core_07_repair_conversation",
  core_08_doctor_repair: "core_08_doctor_repair",
  core_09_identity_shift: "core_09_identity_shift",
  core_10_integrity_favoritism_signal: "core_10_integrity_favoritism_signal",
  core_11_selective_standard_escalation: "core_11_selective_standard_escalation",
  core_12_silence_normalization: "core_12_silence_normalization",
  core_13_assistant_adaptation: "core_13_assistant_adaptation",
  core_14_manager_awareness_gap: "core_14_manager_awareness_gap",
  core_15_system_exposure: "core_15_system_exposure",
  core_16_repair_standard_reset: "core_16_repair_standard_reset",
  core_17_lead_assistant_repair: "core_17_lead_assistant_repair",
  core_18_identity_integrity_choice: "core_18_identity_integrity_choice",
  core_19_authority_signal: "core_19_authority_signal",
  core_20_unquestioned_decision: "core_20_unquestioned_decision",
  core_21_silence_under_hierarchy: "core_21_silence_under_hierarchy",
  core_22_assistant_truth_block: "core_22_assistant_truth_block",
  core_23_manager_truth_block: "core_23_manager_truth_block",
  core_24_external_truth_exposure: "core_24_external_truth_exposure",
  core_25_forced_repair_conversation: "core_25_forced_repair_conversation",
  core_26_doctor_repair_choice: "core_26_doctor_repair_choice",
  core_27_identity_repair_commitment: "core_27_identity_repair_commitment",
};

function unwrapJsonEnvelope(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object") return raw;
  const entries = Object.entries(raw as RawEnvelope);
  if (entries.length !== 1) return raw;
  const [key, value] = entries[0];
  if (!key.endsWith(".json")) return raw;
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid scenario structure");
  }
  return value as Record<string, unknown>;
}

function validateBaseChoiceMappings(choices: BaseChoiceMapping[], expected: string[], strictCommitment = false) {
  const map = new Map(choices.map((c) => [c.choiceId, c]));
  for (const id of expected) {
    const found = map.get(id);
    if (!found || !found.dbChoiceId) {
      throw new Error("Invalid scenario structure");
    }
    if (strictCommitment && typeof found.is_action_commitment !== "boolean") {
      throw new Error("Invalid scenario structure");
    }
  }
}

function validateBaseScenario(base: BaseScenario): void {
  if (!base.scenarioId || !base.dbScenarioId) throw new Error("Invalid scenario structure");
  if (!base.incident?.incidentId) throw new Error("Invalid scenario structure");
  if (typeof base.incident.stage !== "number") throw new Error("Invalid scenario structure");
  if (!base.incident.axisGroup || typeof base.incident.axisIndex !== "number") {
    throw new Error("Invalid scenario structure");
  }
  if (!("previousScenarioId" in base.incident) || !("nextScenarioId" in base.incident)) {
    throw new Error("Invalid scenario structure");
  }
  validateBaseChoiceMappings(base.structure?.primary ?? [], ["A", "B", "C", "D"]);
  const tradeoff = base.structure?.tradeoff ?? {};
  for (const key of ["A", "B", "C", "D"]) {
    validateBaseChoiceMappings(tradeoff[key] ?? [], ["X", "Y"]);
  }
  const actionDecision = base.structure?.action_decision ?? {};
  for (const key of ["A_X", "B_X", "C_X", "D_X"]) {
    validateBaseChoiceMappings(actionDecision[key] ?? [], ["AD1", "AD2"], true);
  }
}

function validateLocalizedScenario(content: LocalizedScenario): void {
  if (!content.id || !content.title || !content.role || !content.pressure || !content.tradeoff) {
    throw new Error("Invalid scenario structure");
  }
  const choiceIds = new Set((content.choices ?? []).map((c) => c.id));
  for (const id of ["A", "B", "C", "D"]) {
    if (!choiceIds.has(id as PrimaryChoiceId)) throw new Error("Invalid scenario structure");
  }
  for (const id of ["A", "B", "C", "D"]) {
    const branch = content.escalationBranches?.[id as PrimaryChoiceId];
    if (!branch?.escalation_text) throw new Error("Invalid scenario structure");
    const secondChoiceIds = new Set((branch.second_choices ?? []).map((c) => c.id));
    if (!secondChoiceIds.has("X") || !secondChoiceIds.has("Y")) {
      throw new Error("Invalid scenario structure");
    }
    const actionChoices = branch.action_decision?.choices ?? [];
    const ad1 = actionChoices.find((c) => c.id === "AD1");
    const ad2 = actionChoices.find((c) => c.id === "AD2");
    if (!ad1 || !ad2) throw new Error("Invalid scenario structure");
    if (ad1.meaning?.is_action_commitment !== true || ad2.meaning?.is_action_commitment !== false) {
      throw new Error("Invalid scenario structure");
    }
  }
}

function validateLocaleStructureParity(en: LocalizedScenario, ko: LocalizedScenario): void {
  const enChoices = en.choices ?? [];
  const koChoices = ko.choices ?? [];
  if (enChoices.length !== koChoices.length) throw new Error("Invalid scenario structure");

  const enBranchKeys = Object.keys(en.escalationBranches ?? {}).sort().join(",");
  const koBranchKeys = Object.keys(ko.escalationBranches ?? {}).sort().join(",");
  if (enBranchKeys !== koBranchKeys) throw new Error("Invalid scenario structure");

  for (const key of Object.keys(en.escalationBranches ?? {})) {
    const enBranch = en.escalationBranches[key as PrimaryChoiceId] as EscalationBranch;
    const koBranch = ko.escalationBranches[key as PrimaryChoiceId] as EscalationBranch;
    if ((enBranch.second_choices ?? []).length !== (koBranch.second_choices ?? []).length) {
      throw new Error("Invalid scenario structure");
    }
    if ((enBranch.action_decision?.choices ?? []).length !== (koBranch.action_decision?.choices ?? []).length) {
      throw new Error("Invalid scenario structure");
    }
  }
}

function bindDbChoiceIds(base: BaseScenario, content: LocalizedScenario): LocalizedScenario {
  const primaryMap = new Map(base.structure.primary.map((c) => [c.choiceId, c.dbChoiceId]));
  const tradeoffMap = new Map<string, string>();
  const actionMap = new Map<string, { dbChoiceId: string; isActionCommitment: boolean }>();

  for (const [primaryId, mappings] of Object.entries(base.structure.tradeoff)) {
    for (const mapping of mappings) {
      tradeoffMap.set(`${primaryId}_${mapping.choiceId}`, mapping.dbChoiceId);
    }
  }

  for (const [branchKey, mappings] of Object.entries(base.structure.action_decision)) {
    for (const mapping of mappings) {
      actionMap.set(`${branchKey}_${mapping.choiceId}`, {
        dbChoiceId: mapping.dbChoiceId,
        isActionCommitment: Boolean(mapping.is_action_commitment),
      });
    }
  }

  const boundChoices = content.choices.map((choice) => ({
    ...choice,
    dbChoiceId: primaryMap.get(choice.id) ?? choice.dbChoiceId,
  }));

  const boundBranches = Object.fromEntries(
    Object.entries(content.escalationBranches).map(([primaryId, branch]) => {
      const secondChoices = (branch.second_choices ?? []).map((second) => ({
        ...second,
        dbChoiceId: tradeoffMap.get(`${primaryId}_${second.id}`) ?? second.dbChoiceId,
      }));
      const actionChoices = (branch.action_decision?.choices ?? []).map((choice) => {
        const resolved = actionMap.get(`${primaryId}_X_${choice.id}`) ?? actionMap.get(`${primaryId}_Y_${choice.id}`);
        return {
          ...choice,
          dbChoiceId: resolved?.dbChoiceId ?? choice.dbChoiceId,
          meaning: {
            ...choice.meaning,
            is_action_commitment: resolved?.isActionCommitment ?? choice.meaning.is_action_commitment,
          },
        };
      });
      return [
        primaryId,
        {
          ...branch,
          second_choices: secondChoices,
          action_decision: {
            ...branch.action_decision,
            choices: actionChoices,
          },
        } satisfies EscalationBranch,
      ];
    }),
  ) as Record<PrimaryChoiceId, EscalationBranch>;

  return {
    ...content,
    choices: boundChoices,
    escalationBranches: boundBranches,
  };
}

function normalizeBundle(bundle: RuntimeBundle): RuntimeScenarioNode {
  const base = unwrapJsonEnvelope(bundle.base) as BaseScenario;
  const en = unwrapJsonEnvelope(bundle.en) as LocalizedScenario;
  const ko = unwrapJsonEnvelope(bundle.ko) as LocalizedScenario;
  validateBaseScenario(base);
  validateLocalizedScenario(en);
  validateLocalizedScenario(ko);
  validateLocaleStructureParity(en, ko);
  return {
    base,
    en: bindDbChoiceIds(base, en),
    ko: bindDbChoiceIds(base, ko),
  };
}

function buildCore(folderId: string, base: unknown, en: unknown, ko: unknown): RuntimeScenarioNode {
  const fallbackBase = unwrapJsonEnvelope(base) as BaseScenario;
  const fallbackEn = unwrapJsonEnvelope(en) as LocalizedScenario;
  const fallbackKo = unwrapJsonEnvelope(ko) as LocalizedScenario;
  try {
    return normalizeBundle({ base, en, ko });
  } catch (error) {
    scenarioValidationErrors.set(
      folderId,
      error instanceof Error ? error.message : "Invalid scenario structure",
    );
    return {
      base: fallbackBase,
      en: fallbackEn,
      ko: fallbackKo,
    };
  }
}

export const scenarioRegistry = {
  incident_01_small_compromise_to_trust_repair: {
    core_01: buildCore("core_01_training_system_exposure", incident01Core01BaseRaw, incident01Core01EnRaw, incident01Core01KoRaw),
    core_02: buildCore("core_02_new_doctor_reexposure_compromise_loop", incident01Core02BaseRaw, incident01Core02EnRaw, incident01Core02KoRaw),
    core_03: buildCore("core_03_training_failure_hidden_as_performance_issue", incident01Core03BaseRaw, incident01Core03EnRaw, incident01Core03KoRaw),
    core_04: buildCore("core_04_manager_neutrality_as_abandonment", incident01Core04BaseRaw, incident01Core04EnRaw, incident01Core04KoRaw),
    core_05: buildCore("core_05_resignation_signal", incident01Core05BaseRaw, incident01Core05EnRaw, incident01Core05KoRaw),
    core_06: buildCore("core_06_external_exposure", incident01Core06BaseRaw, incident01Core06EnRaw, incident01Core06KoRaw),
    core_07: buildCore("core_07_repair_conversation", incident01Core07BaseRaw, incident01Core07EnRaw, incident01Core07KoRaw),
    core_08: buildCore("core_08_doctor_repair", incident01Core08BaseRaw, incident01Core08EnRaw, incident01Core08KoRaw),
    core_09: buildCore("core_09_identity_shift", incident01Core09BaseRaw, incident01Core09EnRaw, incident01Core09KoRaw),
  } satisfies IncidentRuntimeRegistry,
  incident_02_authority_integrity_breakdown: {
    core_01: buildCore("core_10_integrity_favoritism_signal", incident02Core01BaseRaw, incident02Core01EnRaw, incident02Core01KoRaw),
    core_02: buildCore("core_11_selective_standard_escalation", incident02Core02BaseRaw, incident02Core02EnRaw, incident02Core02KoRaw),
    core_03: buildCore("core_12_silence_normalization", incident02Core03BaseRaw, incident02Core03EnRaw, incident02Core03KoRaw),
    core_04: buildCore("core_13_assistant_adaptation", incident02Core04BaseRaw, incident02Core04EnRaw, incident02Core04KoRaw),
    core_05: buildCore("core_14_manager_awareness_gap", incident02Core05BaseRaw, incident02Core05EnRaw, incident02Core05KoRaw),
    core_06: buildCore("core_15_system_exposure", incident02Core06BaseRaw, incident02Core06EnRaw, incident02Core06KoRaw),
    core_07: buildCore("core_16_repair_standard_reset", incident02Core07BaseRaw, incident02Core07EnRaw, incident02Core07KoRaw),
    core_08: buildCore("core_17_lead_assistant_repair", incident02Core08BaseRaw, incident02Core08EnRaw, incident02Core08KoRaw),
    core_09: buildCore("core_18_identity_integrity_choice", incident02Core09BaseRaw, incident02Core09EnRaw, incident02Core09KoRaw),
  } satisfies IncidentRuntimeRegistry,
  incident_03_culture_adoption_toxic_environment_breakdown: {
    core_01: buildCore("core_19_authority_signal", incident03Core01BaseRaw, incident03Core01EnRaw, incident03Core01KoRaw),
    core_02: buildCore("core_20_unquestioned_decision", incident03Core02BaseRaw, incident03Core02EnRaw, incident03Core02KoRaw),
    core_03: buildCore("core_21_silence_under_hierarchy", incident03Core03BaseRaw, incident03Core03EnRaw, incident03Core03KoRaw),
    core_04: buildCore("core_22_assistant_truth_block", incident03Core04BaseRaw, incident03Core04EnRaw, incident03Core04KoRaw),
    core_05: buildCore("core_23_manager_truth_block", incident03Core05BaseRaw, incident03Core05EnRaw, incident03Core05KoRaw),
    core_06: buildCore("core_24_external_truth_exposure", incident03Core06BaseRaw, incident03Core06EnRaw, incident03Core06KoRaw),
    core_07: buildCore("core_25_forced_repair_conversation", incident03Core07BaseRaw, incident03Core07EnRaw, incident03Core07KoRaw),
    core_08: buildCore("core_26_doctor_repair_choice", incident03Core08BaseRaw, incident03Core08EnRaw, incident03Core08KoRaw),
    core_09: buildCore("core_27_identity_repair_commitment", incident03Core09BaseRaw, incident03Core09EnRaw, incident03Core09KoRaw),
  } satisfies IncidentRuntimeRegistry,
} as const;

const scenarioIdToNode = new Map<string, RuntimeScenarioNode>();
const dbScenarioIdToScenarioId = new Map<string, string>();
const folderIdToNode = new Map<string, RuntimeScenarioNode>();

for (const incident of Object.values(scenarioRegistry)) {
  for (const node of Object.values(incident)) {
    scenarioIdToNode.set(node.base.scenarioId, node);
    dbScenarioIdToScenarioId.set(node.base.dbScenarioId, node.base.scenarioId);
  }
}
for (const folderId of scenarioList) {
  const coreScenario = getScenarioByFolderId(folderId);
  folderIdToNode.set(folderId, coreScenario);
}

function getScenarioByFolderId(folderId: ScenarioId): RuntimeScenarioNode {
  const index = scenarioList.indexOf(folderId);
  const incidentBucket = Math.floor(index / 9);
  const coreNumber = (index % 9) + 1;
  const coreKey = `core_${String(coreNumber).padStart(2, "0")}` as IncidentCoreKey;
  if (incidentBucket === 0) return scenarioRegistry.incident_01_small_compromise_to_trust_repair[coreKey];
  if (incidentBucket === 1) return scenarioRegistry.incident_02_authority_integrity_breakdown[coreKey];
  return scenarioRegistry.incident_03_culture_adoption_toxic_environment_breakdown[coreKey];
}

export const getScenarioPath = (id: ScenarioId, locale: Locale) =>
  `/data/scenario/${scenarioFolderByScenarioId[id]}/${locale}.json`;

export const getBasePath = (id: ScenarioId) =>
  `/data/scenario/${scenarioFolderByScenarioId[id]}/base.json`;

function mergeRuntimeScenario(node: RuntimeScenarioNode, locale: Locale): RuntimeScenario {
  const content = locale === "ko" ? node.ko : node.en;
  return {
    base: node.base,
    content,
    scenarioId: node.base.scenarioId,
    dbScenarioId: node.base.dbScenarioId,
    incidentId: node.base.incident.incidentId,
    stage: node.base.incident.stage,
    axisGroup: node.base.incident.axisGroup,
    axisIndex: node.base.incident.axisIndex,
    previousScenarioId: node.base.incident.previousScenarioId,
    nextScenarioId: node.base.incident.nextScenarioId,
    propagation: node.base.incident.propagation,
  };
}

export function getIncident(incidentId: IncidentId) {
  return scenarioRegistry[incidentId];
}

export function getScenarioById(scenarioId: string, locale: Locale): RuntimeScenario | null {
  const node = scenarioIdToNode.get(scenarioId) ?? folderIdToNode.get(scenarioId);
  if (!node) return null;
  if (scenarioValidationErrors.has(scenarioId)) return null;
  return mergeRuntimeScenario(node, locale);
}

export function getScenarioByDbId(dbScenarioId: string, locale: Locale): RuntimeScenario | null {
  const scenarioId = dbScenarioIdToScenarioId.get(dbScenarioId);
  if (!scenarioId) return null;
  return getScenarioById(scenarioId, locale);
}

export function getNextScenario(currentScenarioId: string, locale: Locale): RuntimeScenario | null {
  const current = getScenarioById(currentScenarioId, locale);
  if (!current?.nextScenarioId) return null;
  return getScenarioById(current.nextScenarioId, locale);
}

export function getPreviousScenario(currentScenarioId: string, locale: Locale): RuntimeScenario | null {
  const current = getScenarioById(currentScenarioId, locale);
  if (!current?.previousScenarioId) return null;
  return getScenarioById(current.previousScenarioId, locale);
}

export function initializeScenarioFlow(): RuntimeFlowContext {
  return { state: "SCENARIO_READY" };
}

export function activatePrimaryChoice(flow: RuntimeFlowContext): RuntimeFlowContext {
  if (flow.state !== "SCENARIO_READY" && flow.state !== "NEXT_SCENARIO_READY") {
    throw new Error("Invalid scenario flow");
  }
  return { state: "PRIMARY_CHOICE_ACTIVE" };
}

export function selectPrimaryChoice(
  flow: RuntimeFlowContext,
  primaryChoiceId: PrimaryChoiceId,
): RuntimeFlowContext {
  if (flow.state !== "PRIMARY_CHOICE_ACTIVE") throw new Error("Invalid scenario flow");
  return { state: "TRADEOFF_ACTIVE", primaryChoiceId };
}

export function selectTradeoffChoice(
  flow: RuntimeFlowContext,
  secondChoiceId: SecondChoiceId,
): RuntimeFlowContext {
  if (flow.state !== "TRADEOFF_ACTIVE") throw new Error("Invalid scenario flow");
  return { ...flow, state: "ACTION_DECISION_ACTIVE", secondChoiceId };
}

export function selectActionDecision(
  flow: RuntimeFlowContext,
  actionChoiceId: ActionChoiceId,
  isActionCommitment: boolean,
): RuntimeFlowContext {
  if (flow.state !== "ACTION_DECISION_ACTIVE") throw new Error("Invalid scenario flow");
  return {
    ...flow,
    actionChoiceId,
    isActionCommitment,
    state: isActionCommitment ? "ACTION_REQUIRED" : "NEXT_SCENARIO_READY",
  };
}

function getBaseDbChoiceId(
  baseMappings: BaseChoiceMapping[] | undefined,
  choiceId: string,
  fallback?: string,
): string {
  const mapping = (baseMappings ?? []).find((m) => m.choiceId === choiceId);
  return mapping?.dbChoiceId ?? fallback ?? "";
}

export const patternFamilyCompatibilityMap: Record<string, string> = {
  ownership_act: "ownership_claim",
  system_thinking: "accountability_system",
  blame_shift: "accountability_deflection",
  truth_naming: "truth_naming",
  future_deferral: "future_deferral",
  delegation_deflection: "delegation_deflection",
  integrity_compromise: "integrity_compromise",
  repair_avoidance: "repair_avoidance",
  courage_act: "courage_act",
  control_fixation: "control_fixation",
  self_protection: "identity_drift",
  explanation_substitution: "explanation_substitution",
  conflict_avoidance: "conflict_avoidance",
};

export const allScenarioBundles: ScenarioBundle[] = [
  ...Object.values(scenarioRegistry.incident_01_small_compromise_to_trust_repair),
  ...Object.values(scenarioRegistry.incident_02_authority_integrity_breakdown),
  ...Object.values(scenarioRegistry.incident_03_culture_adoption_toxic_environment_breakdown),
];

export const scenarioById: Record<string, ScenarioBundle> = Object.fromEntries(
  allScenarioBundles.map((b) => [b.base.scenarioId, b]),
);

export const scenarioIncidents: IncidentBundle[] = [
  {
    incidentId: "incident_01_small_compromise_to_trust_repair",
    scenarios: Object.values(
      scenarioRegistry.incident_01_small_compromise_to_trust_repair,
    ).slice().sort((a, b) => a.base.incident.stage - b.base.incident.stage),
  },
  {
    incidentId: "incident_02_authority_integrity_breakdown",
    scenarios: Object.values(
      scenarioRegistry.incident_02_authority_integrity_breakdown,
    ).slice().sort((a, b) => a.base.incident.stage - b.base.incident.stage),
  },
  {
    incidentId: "incident_03_culture_adoption_toxic_environment_breakdown",
    scenarios: Object.values(
      scenarioRegistry.incident_03_culture_adoption_toxic_environment_breakdown,
    ).slice().sort((a, b) => a.base.incident.stage - b.base.incident.stage),
  },
];

export function getScenarioBundle(scenarioId: string): ScenarioBundle | null {
  return scenarioIdToNode.get(scenarioId) ?? folderIdToNode.get(scenarioId) ?? null;
}

export function getScenarioContent(scenarioId: string, locale: Locale): LocalizedScenario | null {
  const bundle = getScenarioBundle(scenarioId);
  if (!bundle) return null;
  return locale === "ko" ? bundle.ko : bundle.en;
}

export function getIncidentScenarios(incidentId: string): ScenarioBundle[] {
  const incident = scenarioIncidents.find((i) => i.incidentId === incidentId);
  return incident?.scenarios ?? [];
}

export function createScenarioDecisionEvent(input: {
  userId: string;
  runtimeScenario: RuntimeScenario;
  primaryChoiceId: PrimaryChoiceId;
  secondChoiceId: SecondChoiceId;
  actionChoiceId: ActionChoiceId;
  timestamp?: string;
}): ScenarioDecisionEvent {
  const branch = input.runtimeScenario.content.escalationBranches[input.primaryChoiceId];
  if (!branch) throw new Error("Invalid scenario structure");
  const primary = input.runtimeScenario.content.choices.find((c) => c.id === input.primaryChoiceId);
  const second = branch.second_choices.find((c) => c.id === input.secondChoiceId);
  const action = branch.action_decision.choices.find((c) => c.id === input.actionChoiceId);
  if (!primary || !second || !action) throw new Error("Invalid scenario structure");

  const tradeoffMappings = input.runtimeScenario.base.structure.tradeoff[input.primaryChoiceId];
  const actionMappings = input.runtimeScenario.base.structure.action_decision[
    `${input.primaryChoiceId}_${input.secondChoiceId}`
  ];

  return {
    userId: input.userId,
    incidentId: input.runtimeScenario.incidentId,
    scenarioId: input.runtimeScenario.scenarioId,
    dbScenarioId: input.runtimeScenario.dbScenarioId,
    stage: input.runtimeScenario.stage,
    axisGroup: input.runtimeScenario.axisGroup,
    axisIndex: input.runtimeScenario.axisIndex,
    role: input.runtimeScenario.content.role,
    primaryChoiceId: input.primaryChoiceId,
    primaryDbChoiceId: getBaseDbChoiceId(
      input.runtimeScenario.base.structure.primary,
      input.primaryChoiceId,
      (primary as { dbChoiceId?: string }).dbChoiceId,
    ),
    primaryDirection: (primary.direction ?? "exit") as "entry" | "exit",
    primaryPatternFamily: String(primary.pattern_family ?? "unknown"),
    secondChoiceId: input.secondChoiceId,
    secondDbChoiceId: getBaseDbChoiceId(
      tradeoffMappings,
      input.secondChoiceId,
      (second as { dbChoiceId?: string }).dbChoiceId,
    ),
    secondDirection: (second.direction ?? "exit") as "entry" | "exit",
    secondPatternFamily: String(second.pattern_family ?? "unknown"),
    actionChoiceId: input.actionChoiceId,
    actionDbChoiceId: getBaseDbChoiceId(
      actionMappings,
      input.actionChoiceId,
      (action as { dbChoiceId?: string }).dbChoiceId,
    ),
    isActionCommitment: Boolean(action.meaning?.is_action_commitment),
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}
