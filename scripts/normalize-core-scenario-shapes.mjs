import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioRoot = path.join(root, "src/data/scenario");

const targetCores = [
  "core_07_repair_conversation",
  "core_10_integrity_favoritism_signal",
  "core_11_selective_standard_escalation",
  "core_12_silence_normalization",
  "core_13_assistant_adaptation",
  "core_14_manager_awareness_gap",
  "core_15_system_exposure",
  "core_16_repair_standard_reset",
  "core_18_identity_integrity_choice",
  "core_19_authority_signal",
  "core_20_unquestioned_decision",
  "core_21_silence_under_hierarchy",
  "core_22_assistant_truth_block",
];

const incidentByCoreNo = (n) => {
  if (n <= 9) return "incident_01_small_compromise_to_trust_repair";
  if (n <= 18) return "incident_02_authority_integrity_breakdown";
  return "incident_03_culture_adoption_toxic_environment_breakdown";
};

const axisGroupByCoreNo = (n) => {
  if (n <= 9) return "Ownership";
  if (n <= 18) return "Truth";
  return "Repair";
};

const fallbackDbChoiceId = (dbScenarioId, kind, key, id) => `${dbScenarioId}_${kind}_${key}_${id}`;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function coreNoFromName(coreName) {
  const m = coreName.match(/^core_(\d{2})_/);
  return m ? Number(m[1]) : 0;
}

function ensureArrayFromChoicesObject(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).map(([id, payload]) => ({
    id,
    ...(payload && typeof payload === "object" ? payload : {}),
  }));
}

function ensureSecondChoices(branch) {
  if (Array.isArray(branch?.second_choices)) return branch.second_choices;
  if (branch?.secondChoices && typeof branch.secondChoices === "object") {
    return Object.entries(branch.secondChoices).map(([id, payload]) => ({
      id,
      ...(payload && typeof payload === "object" ? payload : {}),
    }));
  }
  return [];
}

function normalizeActionDecisionChoices(branch) {
  const raw = branch?.action_decision?.choices;
  const choices = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.entries(raw).map(([id, payload]) => ({ id, ...(payload || {}) }))
      : [];
  const byId = new Map(choices.map((c) => [c.id, c]));
  for (const id of ["AD1", "AD2"]) {
    if (!byId.has(id)) byId.set(id, { id, label: id === "AD1" ? "Commit to action." : "Do not commit." });
  }
  return ["AD1", "AD2"].map((id) => {
    const item = byId.get(id) || { id };
    const commitment =
      item?.meaning?.is_action_commitment ??
      item?.is_action_commitment ??
      (id === "AD1");
    return {
      ...item,
      meaning: {
        ...(item.meaning && typeof item.meaning === "object" ? item.meaning : {}),
        is_action_commitment: Boolean(commitment),
      },
    };
  });
}

function syncTopLevelKeys(en, ko) {
  const keys = new Set([...Object.keys(en), ...Object.keys(ko)]);
  for (const key of keys) {
    if (!(key in en)) en[key] = null;
    if (!(key in ko)) ko[key] = null;
  }
}

function normalizeLocale(locale, coreName) {
  locale.choices = ensureArrayFromChoicesObject(locale.choices ?? locale.primaryChoices);
  const choiceMap = new Map(locale.choices.map((c) => [c.id, c]));
  for (const id of ["A", "B", "C", "D"]) {
    if (!choiceMap.has(id)) {
      choiceMap.set(id, {
        id,
        label: `Choice ${id}`,
        direction: id === "B" ? "entry" : "exit",
      });
    }
  }
  locale.choices = ["A", "B", "C", "D"].map((id) => choiceMap.get(id));

  const branches = locale.escalationBranches && typeof locale.escalationBranches === "object"
    ? locale.escalationBranches
    : {};
  const firstBranch = Object.values(branches).find((b) => b && typeof b === "object") || {};
  const normalized = {};
  for (const id of ["A", "B", "C", "D"]) {
    const branch = (branches[id] && typeof branches[id] === "object") ? branches[id] : { ...firstBranch };
    const secondChoices = ensureSecondChoices(branch);
    const secondMap = new Map(secondChoices.map((c) => [c.id, c]));
    for (const sid of ["X", "Y"]) {
      if (!secondMap.has(sid)) {
        secondMap.set(sid, {
          id: sid,
          label: sid === "X" ? "Choose caution." : "Choose commitment.",
          direction: sid === "Y" ? "entry" : "exit",
        });
      }
    }
    normalized[id] = {
      ...branch,
      escalation_text: branch.escalation_text || `Escalation path ${id} for ${coreName}.`,
      second_choices: ["X", "Y"].map((sid) => secondMap.get(sid)),
      action_decision: {
        ...(branch.action_decision && typeof branch.action_decision === "object" ? branch.action_decision : {}),
        prompt: branch?.action_decision?.prompt || "Choose the observable action.",
        context: branch?.action_decision?.context || "",
        choices: normalizeActionDecisionChoices(branch),
      },
    };
    delete normalized[id].secondChoices;
  }
  locale.escalationBranches = normalized;
  delete locale.primaryChoices;
}

function normalizeBase(base, coreName) {
  const coreNo = coreNoFromName(coreName);
  const dbScenarioId = base.dbScenarioId || `INCIDENT-${String(Math.ceil(coreNo / 9)).padStart(2, "0")}-${String(coreNo).padStart(2, "0")}`;
  base.dbScenarioId = dbScenarioId;
  base.scenarioId ||= coreName;
  base.incident ||= {};
  base.incident.incidentId ||= incidentByCoreNo(coreNo);
  base.incident.stage ??= coreNo;
  base.incident.axisGroup ||= axisGroupByCoreNo(coreNo);
  base.incident.axisIndex ??= ((coreNo - 1) % 9) + 1;
  if (!("previousScenarioId" in base.incident)) base.incident.previousScenarioId = null;
  if (!("nextScenarioId" in base.incident)) base.incident.nextScenarioId = null;

  base.structure ||= {};
  const primaryExisting = Array.isArray(base.structure.primary)
    ? base.structure.primary
    : ensureArrayFromChoicesObject(base.primaryChoices).map((c) => ({ choiceId: c.id }));
  const primaryMap = new Map(primaryExisting.map((c) => [c.choiceId, c]));
  base.structure.primary = ["A", "B", "C", "D"].map((id) => {
    const item = primaryMap.get(id) || {};
    return {
      choiceId: id,
      dbChoiceId: item.dbChoiceId || fallbackDbChoiceId(dbScenarioId, "primary", id, id),
    };
  });

  base.structure.tradeoff ||= {};
  for (const pid of ["A", "B", "C", "D"]) {
    const raw = base.structure.tradeoff[pid] ?? base.tradeoff?.[pid];
    const arr = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object"
        ? Object.keys(raw).map((sid) => ({ choiceId: sid }))
        : [];
    const byId = new Map(arr.map((x) => [x.choiceId, x]));
    base.structure.tradeoff[pid] = ["X", "Y"].map((sid) => ({
      choiceId: sid,
      dbChoiceId:
        byId.get(sid)?.dbChoiceId || fallbackDbChoiceId(dbScenarioId, "tradeoff", pid, sid),
    }));
  }

  base.structure.action_decision ||= {};
  for (const pid of ["A", "B", "C", "D"]) {
    const branchKey = `${pid}_X`;
    const raw = base.structure.action_decision[branchKey] ?? base.action_decision_mapping?.[branchKey];
    const arr = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object"
        ? ["AD1", "AD2"].map((aid) => ({ choiceId: aid }))
        : [];
    const byId = new Map(arr.map((x) => [x.choiceId, x]));
    base.structure.action_decision[branchKey] = ["AD1", "AD2"].map((aid) => ({
      choiceId: aid,
      dbChoiceId:
        byId.get(aid)?.dbChoiceId || fallbackDbChoiceId(dbScenarioId, "action", branchKey, aid),
      is_action_commitment: aid === "AD1",
    }));
  }
}

for (const coreName of targetCores) {
  const corePath = path.join(scenarioRoot, coreName);
  const basePath = path.join(corePath, "base.json");
  const enPath = path.join(corePath, "en.json");
  const koPath = path.join(corePath, "ko.json");
  if (!fs.existsSync(basePath) || !fs.existsSync(enPath) || !fs.existsSync(koPath)) continue;

  const base = readJson(basePath);
  const en = readJson(enPath);
  const ko = readJson(koPath);

  normalizeBase(base, coreName);
  normalizeLocale(en, coreName);
  normalizeLocale(ko, coreName);
  syncTopLevelKeys(en, ko);

  writeJson(basePath, base);
  writeJson(enPath, en);
  writeJson(koPath, ko);
}

console.log(`Normalized ${targetCores.length} core scenario directories.`);
