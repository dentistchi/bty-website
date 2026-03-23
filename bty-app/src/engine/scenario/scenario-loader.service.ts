/**
 * `src/data/scenarios/{en,ko}/*.json` → Zod 검증 (`schema.validator`) → `public.scenarios` upsert.
 * Node 런타임 전용 (`fs`). Edge에서는 호출하지 말 것.
 */

import { readdir } from "fs/promises";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Scenario } from "@/data/scenarios/schema.validator";
import { validateScenarioFile } from "@/data/scenarios/schema.validator";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type { Scenario } from "@/data/scenarios/schema.validator";

export type LoadResult = {
  ok: boolean;
  insertedOrUpdated: number;
  errors: { path: string; message: string }[];
  byLocale: { en: number; ko: number };
};

function dataScenariosRoot(): string {
  return path.join(process.cwd(), "src", "data", "scenarios");
}

type ScenarioRow = {
  id: string;
  locale: string;
  title: string;
  body: string;
  choices: unknown;
  flag_type: string | null;
  scenario_type: string;
  difficulty: number;
};

async function listJsonFiles(localeDir: string): Promise<string[]> {
  const names = await readdir(localeDir).catch(() => []);
  return names.filter((n) => n.endsWith(".json"));
}

/**
 * `en/`·`ko/` 아래 모든 `.json`을 읽어 Zod 검증 후 일괄 upsert. 서비스 롤 클라이언트 필요.
 */
export async function loadAllScenarios(): Promise<LoadResult> {
  const errors: { path: string; message: string }[] = [];
  let en = 0;
  let ko = 0;
  const batch: Scenario[] = [];

  const root = dataScenariosRoot();

  for (const loc of ["en", "ko"] as const) {
    const dir = path.join(root, loc);
    const files = await listJsonFiles(dir);
    for (const file of files) {
      const full = path.join(dir, file);
      try {
        const { data } = await validateScenarioFile(full);
        if (data.locale !== loc) {
          errors.push({
            path: full,
            message: `locale ${data.locale} does not match folder ${loc}`,
          });
          continue;
        }
        batch.push(data);
        if (loc === "en") en += 1;
        else ko += 1;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push({ path: full, message });
      }
    }
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    errors.push({
      path: "(env)",
      message: "SUPABASE_SERVICE_ROLE_KEY not set — cannot upsert scenarios",
    });
    return {
      ok: false,
      insertedOrUpdated: 0,
      errors,
      byLocale: { en: 0, ko: 0 },
    };
  }

  if (batch.length === 0) {
    return {
      ok: errors.length === 0,
      insertedOrUpdated: 0,
      errors,
      byLocale: { en, ko },
    };
  }

  const rows = batch.map((s) => ({
    locale: s.locale,
    id: s.id,
    title: s.title,
    body: s.body,
    choices: s.choices,
    flag_type: "",
    scenario_type: s.scenario_type,
    difficulty: s.difficulty,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin.from("scenarios").upsert(rows, {
    onConflict: "locale,id",
  });

  if (error) {
    errors.push({ path: "(database)", message: error.message });
    return {
      ok: false,
      insertedOrUpdated: 0,
      errors,
      byLocale: { en: 0, ko: 0 },
    };
  }

  return {
    ok: errors.length === 0,
    insertedOrUpdated: batch.length,
    errors,
    byLocale: { en, ko },
  };
}

/**
 * DB에서 단일 시나리오 조회. 없으면 `null`.
 */
export async function getScenarioById(
  id: string,
  locale: "en" | "ko",
  supabase?: SupabaseClient,
): Promise<Scenario | null> {
  const client = supabase ?? (await getSupabaseServerClient());
  const { data, error } = await client
    .from("scenarios")
    .select("id, locale, title, body, choices, flag_type, scenario_type, difficulty")
    .eq("id", id)
    .eq("locale", locale)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as ScenarioRow;
  const choices = Array.isArray(row.choices) ? row.choices : [];
  const d = Number(row.difficulty);
  const difficulty = d === 1 || d === 2 || d === 3 ? d : 2;

  return {
    id: row.id,
    locale: row.locale as "en" | "ko",
    title: row.title,
    body: row.body,
    choices: choices as Scenario["choices"],
    scenario_type: row.scenario_type ?? "",
    difficulty,
  };
}
