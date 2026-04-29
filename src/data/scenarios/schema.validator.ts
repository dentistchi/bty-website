/**
 * Zod 검증 — `src/data/scenarios/{en,ko}/*.json` 로드 시 스키마 일치 확인.
 * 실패 시 {@link ScenarioValidationError} (filePath + field).
 */

import { readdir, readFile } from "fs/promises";
import path from "path";
import { z } from "zod";

const choiceSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  flag_type: z.string(),
});

export const ScenarioSchema = z.object({
  id: z.string().min(1),
  locale: z.enum(["ko", "en"]),
  title: z.string(),
  body: z.string(),
  choices: z.array(choiceSchema).min(1),
  scenario_type: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export type Scenario = z.infer<typeof ScenarioSchema>;

export type ValidationResult = {
  ok: true;
  data: Scenario;
};

export class ScenarioValidationError extends Error {
  readonly name = "ScenarioValidationError";

  constructor(
    public readonly filePath: string,
    public readonly field: string,
    message: string,
  ) {
    super(
      `[ScenarioValidationError] ${filePath} — ${field}: ${message}`,
    );
    Object.setPrototypeOf(this, ScenarioValidationError.prototype);
  }
}

function zodFieldMessage(error: z.ZodError): { field: string; message: string } {
  const iss = error.issues[0];
  if (!iss) {
    return { field: "(unknown)", message: error.message };
  }
  const field =
    iss.path.length > 0 ? iss.path.map((p) => String(p)).join(".") : "(root)";
  return { field, message: iss.message };
}

/** `src/data/scenarios` (cwd 기준). */
export function scenariosDataRoot(): string {
  return path.join(process.cwd(), "src", "data", "scenarios");
}

/**
 * 단일 JSON 파일 검증. 성공 시 `{ ok: true, data }`, 실패 시 {@link ScenarioValidationError} throw.
 */
export async function validateScenarioFile(filePath: string): Promise<ValidationResult> {
  let rawText: string;
  try {
    rawText = await readFile(filePath, "utf8");
  } catch (e) {
    throw new ScenarioValidationError(
      filePath,
      "(read)",
      e instanceof Error ? e.message : String(e),
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText) as unknown;
  } catch (e) {
    throw new ScenarioValidationError(
      filePath,
      "(json)",
      e instanceof Error ? e.message : "invalid JSON",
    );
  }

  const result = ScenarioSchema.safeParse(parsedJson);
  if (!result.success) {
    const { field, message } = zodFieldMessage(result.error);
    throw new ScenarioValidationError(filePath, field, message);
  }

  return { ok: true, data: result.data };
}

async function listJsonUnderLocale(locale: "en" | "ko"): Promise<string[]> {
  const dir = path.join(scenariosDataRoot(), locale);
  const names = await readdir(dir).catch(() => []);
  return names.filter((n) => n.endsWith(".json")).map((n) => path.join(dir, n));
}

/**
 * `en/`·`ko/` 아래 모든 `.json`을 순서대로 검증한다. 하나라도 실패하면 {@link ScenarioValidationError} throw.
 * (최대 ~100개 규모를 가정한 로드 타임 일괄 검증.)
 */
export async function validateAllScenarioJsonFilesAtLoad(): Promise<{
  count: number;
  paths: string[];
}> {
  const en = await listJsonUnderLocale("en");
  const ko = await listJsonUnderLocale("ko");
  const paths = [...en, ...ko].sort();

  for (const p of paths) {
    await validateScenarioFile(p);
  }

  return { count: paths.length, paths };
}
