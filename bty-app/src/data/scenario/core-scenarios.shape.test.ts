import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const scenarioDir = join(process.cwd(), "src/data/scenario");
const coreDirs = readdirSync(scenarioDir)
  .filter((name) => /^core_\d{2}_/.test(name))
  .sort();

type JsonObject = Record<string, unknown>;

function readJsonObject(filePath: string): JsonObject {
  return JSON.parse(readFileSync(filePath, "utf8")) as JsonObject;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pushError(errors: string[], coreId: string, fileName: string, path: string, message: string) {
  errors.push(`[${coreId}] ${fileName} @ ${path}: ${message}`);
}

function hasPath(obj: unknown, path: string): boolean {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (!isObject(cur) || !(part in cur)) return false;
    cur = cur[part];
  }
  return true;
}

function asObjectWithError(
  value: unknown,
  errors: string[],
  coreId: string,
  fileName: string,
  path: string,
): JsonObject {
  if (!isObject(value)) {
    pushError(errors, coreId, fileName, path, "must be an object");
    return {};
  }
  return value;
}

function extractChoiceIds(
  value: unknown,
  errors: string[],
  coreId: string,
  fileName: string,
  path: string,
  idKey: "id" | "choiceId" = "id",
): Set<string> {
  if (!Array.isArray(value)) {
    pushError(errors, coreId, fileName, path, "must be an array");
    return new Set<string>();
  }
  const ids = value
    .map((item, index) => {
      if (!isObject(item)) {
        pushError(errors, coreId, fileName, `${path}[${index}]`, "must be an object");
        return "";
      }
      const id = item[idKey];
      if (typeof id !== "string") {
        pushError(errors, coreId, fileName, `${path}[${index}].${idKey}`, "must be a string");
        return "";
      }
      return id;
    })
    .filter(Boolean);
  return new Set(ids);
}

function assertExactIds(
  ids: Set<string>,
  expected: string[],
  errors: string[],
  coreId: string,
  fileName: string,
  path: string,
) {
  const missing = expected.filter((id) => !ids.has(id));
  const extra = [...ids].filter((id) => !expected.includes(id));
  if (missing.length > 0) {
    pushError(errors, coreId, fileName, path, `missing ids: ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    pushError(errors, coreId, fileName, path, `unexpected ids: ${extra.join(", ")}`);
  }
}

describe("src/data/scenario core shape", () => {
  it("has 27 core scenario directories", () => {
    expect(coreDirs.length).toBe(27);
  });

  it.each(coreDirs)("validates shape for %s", (coreId) => {
    const errors: string[] = [];
    const corePath = join(scenarioDir, coreId);
    const basePath = join(corePath, "base.json");
    const enPath = join(corePath, "en.json");
    const koPath = join(corePath, "ko.json");

    for (const [filePath, fileName] of [
      [basePath, "base.json"],
      [enPath, "en.json"],
      [koPath, "ko.json"],
    ] as const) {
      if (!existsSync(filePath)) {
        pushError(errors, coreId, fileName, "$", "file missing");
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join("\n"));
    }

    const baseJson = readJsonObject(basePath);
    const enJson = readJsonObject(enPath);
    const koJson = readJsonObject(koPath);

    // 1) envelope key 금지
    for (const key of ["base.json", "en.json", "ko.json"]) {
      if (key in baseJson) pushError(errors, coreId, "base.json", `$["${key}"]`, "envelope key forbidden");
      if (key in enJson) pushError(errors, coreId, "en.json", `$["${key}"]`, "envelope key forbidden");
      if (key in koJson) pushError(errors, coreId, "ko.json", `$["${key}"]`, "envelope key forbidden");
    }

    // 3) base 필수 필드
    for (const path of [
      "scenarioId",
      "dbScenarioId",
      "incident",
      "incident.incidentId",
      "incident.stage",
      "incident.axisGroup",
      "incident.axisIndex",
      "incident.previousScenarioId",
      "incident.nextScenarioId",
      "structure.primary",
      "structure.tradeoff",
      "structure.action_decision",
    ]) {
      if (!hasPath(baseJson, path)) {
        pushError(errors, coreId, "base.json", path, "required field missing");
      }
    }

    const structure = asObjectWithError(baseJson.structure, errors, coreId, "base.json", "structure");
    const primaryIds = extractChoiceIds(
      structure.primary,
      errors,
      coreId,
      "base.json",
      "structure.primary",
      "choiceId",
    );
    assertExactIds(primaryIds, ["A", "B", "C", "D"], errors, coreId, "base.json", "structure.primary");

    const tradeoff = asObjectWithError(
      structure.tradeoff,
      errors,
      coreId,
      "base.json",
      "structure.tradeoff",
    );
    for (const primary of ["A", "B", "C", "D"]) {
      const secondIds = extractChoiceIds(
        tradeoff[primary],
        errors,
        coreId,
        "base.json",
        `structure.tradeoff.${primary}`,
        "choiceId",
      );
      assertExactIds(secondIds, ["X", "Y"], errors, coreId, "base.json", `structure.tradeoff.${primary}`);
    }

    const actionDecision = asObjectWithError(
      structure.action_decision,
      errors,
      coreId,
      "base.json",
      "structure.action_decision",
    );
    for (const branchKey of ["A_X", "B_X", "C_X", "D_X"]) {
      const actionIds = extractChoiceIds(
        actionDecision[branchKey],
        errors,
        coreId,
        "base.json",
        `structure.action_decision.${branchKey}`,
        "choiceId",
      );
      assertExactIds(
        actionIds,
        ["AD1", "AD2"],
        errors,
        coreId,
        "base.json",
        `structure.action_decision.${branchKey}`,
      );
    }

    // 4) en/ko 구조 동일성
    const enTopKeys = Object.keys(enJson).sort();
    const koTopKeys = Object.keys(koJson).sort();
    if (enTopKeys.join(",") !== koTopKeys.join(",")) {
      pushError(errors, coreId, "en.json|ko.json", "$", "top-level key set mismatch");
    }

    const enChoiceIds = extractChoiceIds(enJson.choices, errors, coreId, "en.json", "choices");
    const koChoiceIds = extractChoiceIds(koJson.choices, errors, coreId, "ko.json", "choices");
    assertExactIds(enChoiceIds, ["A", "B", "C", "D"], errors, coreId, "en.json", "choices");
    assertExactIds(koChoiceIds, ["A", "B", "C", "D"], errors, coreId, "ko.json", "choices");
    if ([...enChoiceIds].sort().join(",") !== [...koChoiceIds].sort().join(",")) {
      pushError(errors, coreId, "en.json|ko.json", "choices", "choice ids mismatch between locales");
    }

    const enEscalation = asObjectWithError(
      enJson.escalationBranches,
      errors,
      coreId,
      "en.json",
      "escalationBranches",
    );
    const koEscalation = asObjectWithError(
      koJson.escalationBranches,
      errors,
      coreId,
      "ko.json",
      "escalationBranches",
    );

    const enBranchKeys = Object.keys(enEscalation).sort();
    const koBranchKeys = Object.keys(koEscalation).sort();
    if (enBranchKeys.join(",") !== koBranchKeys.join(",")) {
      pushError(errors, coreId, "en.json|ko.json", "escalationBranches", "branch keys mismatch between locales");
    }
    const expectedBranches = ["A", "B", "C", "D"];
    if (enBranchKeys.join(",") !== expectedBranches.join(",")) {
      pushError(errors, coreId, "en.json", "escalationBranches", "must contain A/B/C/D");
    }
    if (koBranchKeys.join(",") !== expectedBranches.join(",")) {
      pushError(errors, coreId, "ko.json", "escalationBranches", "must contain A/B/C/D");
    }

    for (const branch of expectedBranches) {
      const enBranch = asObjectWithError(
        enEscalation[branch],
        errors,
        coreId,
        "en.json",
        `escalationBranches.${branch}`,
      );
      const koBranch = asObjectWithError(
        koEscalation[branch],
        errors,
        coreId,
        "ko.json",
        `escalationBranches.${branch}`,
      );

      const enSecondIds = extractChoiceIds(
        enBranch.second_choices,
        errors,
        coreId,
        "en.json",
        `escalationBranches.${branch}.second_choices`,
      );
      const koSecondIds = extractChoiceIds(
        koBranch.second_choices,
        errors,
        coreId,
        "ko.json",
        `escalationBranches.${branch}.second_choices`,
      );
      assertExactIds(
        enSecondIds,
        ["X", "Y"],
        errors,
        coreId,
        "en.json",
        `escalationBranches.${branch}.second_choices`,
      );
      assertExactIds(
        koSecondIds,
        ["X", "Y"],
        errors,
        coreId,
        "ko.json",
        `escalationBranches.${branch}.second_choices`,
      );
      if ([...enSecondIds].sort().join(",") !== [...koSecondIds].sort().join(",")) {
        pushError(
          errors,
          coreId,
          "en.json|ko.json",
          `escalationBranches.${branch}.second_choices`,
          "second choice ids mismatch between locales",
        );
      }

      const enSecondArray = Array.isArray(enBranch.second_choices) ? enBranch.second_choices : [];
      const koSecondArray = Array.isArray(koBranch.second_choices) ? koBranch.second_choices : [];
      for (const [fileName, arr, basePathPrefix] of [
        ["en.json", enSecondArray, `escalationBranches.${branch}.second_choices`],
        ["ko.json", koSecondArray, `escalationBranches.${branch}.second_choices`],
      ] as const) {
        arr.forEach((item, index) => {
          if (!isObject(item)) {
            pushError(errors, coreId, fileName, `${basePathPrefix}[${index}]`, "must be an object");
            return;
          }
          const id = typeof item.id === "string" ? item.id : String(index);
          const cost = item.cost;
          if (typeof cost !== "string" || cost.trim().length === 0) {
            pushError(
              errors,
              coreId,
              fileName,
              `${basePathPrefix}[${index}].id=${id}.cost`,
              "must be a non-empty string",
            );
          }
        });
      }

      const enActionDecision = asObjectWithError(
        enBranch.action_decision,
        errors,
        coreId,
        "en.json",
        `escalationBranches.${branch}.action_decision`,
      );
      const koActionDecision = asObjectWithError(
        koBranch.action_decision,
        errors,
        coreId,
        "ko.json",
        `escalationBranches.${branch}.action_decision`,
      );
      const enAdIds = extractChoiceIds(
        enActionDecision.choices,
        errors,
        coreId,
        "en.json",
        `escalationBranches.${branch}.action_decision.choices`,
      );
      const koAdIds = extractChoiceIds(
        koActionDecision.choices,
        errors,
        coreId,
        "ko.json",
        `escalationBranches.${branch}.action_decision.choices`,
      );
      assertExactIds(
        enAdIds,
        ["AD1", "AD2"],
        errors,
        coreId,
        "en.json",
        `escalationBranches.${branch}.action_decision.choices`,
      );
      assertExactIds(
        koAdIds,
        ["AD1", "AD2"],
        errors,
        coreId,
        "ko.json",
        `escalationBranches.${branch}.action_decision.choices`,
      );
      if ([...enAdIds].sort().join(",") !== [...koAdIds].sort().join(",")) {
        pushError(
          errors,
          coreId,
          "en.json|ko.json",
          `escalationBranches.${branch}.action_decision.choices`,
          "action decision ids mismatch between locales",
        );
      }

      // 5) action_decision commitment 규칙
      const enChoices = Array.isArray(enActionDecision.choices) ? enActionDecision.choices : [];
      const enAD1 = enChoices.find((c) => isObject(c) && c.id === "AD1");
      const enAD2 = enChoices.find((c) => isObject(c) && c.id === "AD2");
      const ad1Commit = isObject(enAD1) && isObject(enAD1.meaning) ? enAD1.meaning.is_action_commitment : undefined;
      const ad2Commit = isObject(enAD2) && isObject(enAD2.meaning) ? enAD2.meaning.is_action_commitment : undefined;
      if (ad1Commit !== true) {
        pushError(
          errors,
          coreId,
          "en.json",
          `escalationBranches.${branch}.action_decision.choices.AD1.meaning.is_action_commitment`,
          "must be true",
        );
      }
      if (ad2Commit !== false) {
        pushError(
          errors,
          coreId,
          "en.json",
          `escalationBranches.${branch}.action_decision.choices.AD2.meaning.is_action_commitment`,
          "must be false",
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join("\n"));
    }
  });
});
