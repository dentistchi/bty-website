/**
 * Perspective switch — 최근 Arena 선택 시나리오를 역지사지(상대 역할) 버전으로 풀에 반영.
 * 원본은 `arena_events`(CHOICE_CONFIRMED); 저장은 `mirror_scenario_pool`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getRoleMirrorScenario } from "@/engine/integrity/role-mirror-content.service";
import type { ScenarioLocalePreference } from "@/engine/scenario/scenario-selector.service";
import { getScenarioById } from "@/lib/bty/scenario/scenarios";
import type { Scenario, ScenarioChoice } from "@/lib/bty/scenario/types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function resolveMirrorDbClient(supabase?: SupabaseClient): SupabaseClient {
  const c = supabase ?? getSupabaseAdmin();
  if (!c) {
    throw new Error(
      "[mirror-scenario] Pass supabase from a route handler or set SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return c;
}

/** Synthetic {@link Scenario.scenarioId} prefix for rows from `mirror_scenario_pool`. */
export const MIRROR_SCENARIO_PREFIX = "mirror:" as const;

/**
 * Legacy `mirror_scenario_pool` (20260416010000) required `scenario_type` + `air_delta`; later migrations
 * added origin/mirror columns but did not drop NOT NULL legacy columns on live DBs.
 */
const MIRROR_POOL_SCENARIO_TYPE_CATALOG = "mirror_perspective" as const;
const MIRROR_POOL_SCENARIO_TYPE_ROLE_CURATED = "role_mirror_curated" as const;
const MIRROR_POOL_AIR_DELTA_NEUTRAL = 0;

const CHOICE_CONFIRMED = "CHOICE_CONFIRMED" as const;
const LAST_N_SCENARIOS = 3;

export type MirrorChoiceSnapshot = {
  choiceId: string;
  label: string;
  labelKo?: string;
  intent: string;
};

export type MirrorScenario = {
  id: string;
  user_id: string;
  origin_scenario_id: string;
  target_role: string;
  mirror_title: string;
  mirror_context: string;
  mirror_title_ko?: string | null;
  mirror_context_ko?: string | null;
  mirror_choices?: MirrorChoiceSnapshot[] | null;
  origin_choice_id?: string | null;
  created_at: string;
};

/**
 * Pool row → lib {@link Scenario} for Arena shell + submit (`scenarioId` = `mirror:` + row id).
 */
export function mirrorPoolRowToScenario(m: MirrorScenario, locale: ScenarioLocalePreference): Scenario {
  const snaps = m.mirror_choices ?? [];
  const choiceIds = ["A", "B", "C", "D"] as const;
  const baseHidden = {
    integrity: 1,
    communication: 1,
    insight: 1,
    resilience: 1,
    gratitude: 0,
  } as const;
  const choices: ScenarioChoice[] = choiceIds.map((cid, i) => {
    const s = snaps[i];
    if (s) {
      return {
        choiceId: cid,
        label: s.label,
        labelKo: s.labelKo,
        intent: s.intent,
        xpBase: 40,
        difficulty: 1,
        hiddenDelta: { ...baseHidden },
        result: "Mirror practice outcome recorded.",
        resultKo: "역지사지 연습 결과가 기록되었습니다.",
        microInsight: "Notice how the mirrored role reframes the tension.",
        microInsightKo: "역지사지 역할이 긴장을 어떻게 바꾸는지 살펴보세요.",
      };
    }
    return {
      choiceId: cid,
      label: "—",
      intent: "—",
      xpBase: 40,
      difficulty: 1,
      hiddenDelta: { ...baseHidden },
      result: "Mirror practice outcome recorded.",
      resultKo: "역지사지 연습 결과가 기록되었습니다.",
      microInsight: "Notice how the mirrored role reframes the tension.",
      microInsightKo: "역지사지 역할이 긴장을 어떻게 바꾸는지 살펴보세요.",
    };
  });

  const title = locale === "ko" && m.mirror_title_ko ? m.mirror_title_ko : m.mirror_title;
  const context = locale === "ko" && m.mirror_context_ko ? m.mirror_context_ko : m.mirror_context;

  return {
    scenarioId: `${MIRROR_SCENARIO_PREFIX}${m.id}`,
    title,
    context,
    titleKo: m.mirror_title_ko ?? undefined,
    contextKo: m.mirror_context_ko ?? undefined,
    choices,
    coachNotes: {
      whatThisTrains: ["communication", "insight"],
      whyItMatters: "Mirror / perspective-taking practice.",
    },
  };
}

/**
 * Resolve a `mirror:<uuid>` scenario for CHOICE_CONFIRMED / XP (RLS: own pool row).
 */
export async function getMirrorScenarioForLocaleSubmit(
  userId: string,
  scenarioId: string,
  locale: ScenarioLocalePreference,
  supabase?: SupabaseClient,
): Promise<Scenario | null> {
  if (!scenarioId.startsWith(MIRROR_SCENARIO_PREFIX)) return null;
  const rawId = scenarioId.slice(MIRROR_SCENARIO_PREFIX.length);
  const client = resolveMirrorDbClient(supabase);
  const { data, error } = await client
    .from("mirror_scenario_pool")
    .select(
      "id, user_id, origin_scenario_id, target_role, mirror_title, mirror_context, mirror_title_ko, mirror_context_ko, mirror_choices, origin_choice_id, created_at",
    )
    .eq("user_id", userId)
    .eq("id", rawId)
    .maybeSingle();
  if (error || !data) return null;
  return mirrorPoolRowToScenario(data as MirrorScenario, locale);
}

const TARGET_ROLE_LABEL_KO: Record<string, string> = {
  patient: "환자",
  hygienist: "위생사",
  assistant: "어시스턴트",
  manager: "매니저·경영",
  office_staff: "프론트·코디네이터",
  peer_clinician: "동료 의사",
  team_member: "팀원",
  associate: "어소시에이트",
  peer: "상대",
};

/**
 * 시나리오 id·제목 힌트로 “원본에서 당신이 아닌 쪽”(미러에서 플레이할 역할 키)을 추정한다.
 * 대부분의 Arena 시나리오는 진료자·리더 시점이므로, 상대방 축을 돌려 쓴다.
 */
export function inferMirrorTargetRole(scenarioId: string): string {
  const id = scenarioId.toLowerCase();
  if (id.includes("patient")) return "patient";
  if (id.includes("hygienist")) return "hygienist";
  if (id.includes("assistant")) return "assistant";
  if (id.includes("manager") || id.includes("dso")) return "manager";
  if (id.includes("front_desk") || id.includes("insurance_coordinator")) return "office_staff";
  if (id.includes("doctor_chronic") || id.includes("doctor_disagrees") || id.includes("doctor_production")) {
    return "peer_clinician";
  }
  if (id.includes("doctor_") || id.includes("associate")) return "associate";
  if (id.includes("team") || id.includes("staff_arrives") || id.includes("staff_")) return "team_member";
  return "peer";
}

function roleLabelKo(role: string): string {
  return TARGET_ROLE_LABEL_KO[role] ?? role;
}

/**
 * EN title/body + KO title/body + choice snapshots (label / labelKo) for pool persistence.
 */
export function buildMirrorCopyBilingual(
  originScenarioId: string,
  targetRole: string,
  options?: { originChoiceId?: string },
): {
  mirror_title: string;
  mirror_title_ko: string;
  mirror_context: string;
  mirror_context_ko: string;
  mirror_choices: MirrorChoiceSnapshot[];
} {
  const scenario = getScenarioById(originScenarioId);
  const titleEn = scenario?.title ?? originScenarioId;
  const titleKo = scenario?.titleKo ?? scenario?.title ?? originScenarioId;
  const label = roleLabelKo(targetRole);
  const choice = options?.originChoiceId
    ? scenario?.choices.find((c) => c.choiceId === options.originChoiceId)
    : undefined;
  const choiceNoteEn = choice ? ` Grounded in choice ${choice.choiceId}: ${choice.label}.` : "";
  const choiceNoteKo =
    choice && choice.labelKo ? ` 촉발 선택: ${choice.choiceId} — ${choice.labelKo}.` : choiceNoteEn;

  const mirror_title = `[Mirror] ${titleEn} — ${targetRole} role`;
  const mirror_title_ko = `[역지사지] ${titleKo} — ${label} 역할`;
  const mirror_context =
    `From scenario「${titleEn}」you played as clinician/leader; in this mirror you take the ${targetRole} POV with the same tension.${choiceNoteEn} (source: ${originScenarioId})`;
  const mirror_context_ko =
    `원본 시나리오「${titleKo}」에서는 진료자·리더 시점이었다면, 이 연습에서는 ${label} 입장에서 같은 긴장과 선택을 다룹니다.${choiceNoteKo} (출처: ${originScenarioId} → mirror target: ${targetRole})`;

  const mirror_choices: MirrorChoiceSnapshot[] =
    scenario?.choices.map((c) => ({
      choiceId: c.choiceId,
      label: c.label,
      labelKo: c.labelKo,
      intent: c.intent,
    })) ?? [];

  return { mirror_title, mirror_title_ko, mirror_context, mirror_context_ko, mirror_choices };
}

async function lastDistinctScenarioIds(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data: events, error } = await client
    .from("arena_events")
    .select("scenario_id, created_at")
    .eq("user_id", userId)
    .eq("event_type", CHOICE_CONFIRMED)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw new Error(error.message);
  if (!events?.length) return [];

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const ev of events) {
    const sid = typeof ev.scenario_id === "string" ? ev.scenario_id.trim() : "";
    if (!sid || seen.has(sid)) continue;
    seen.add(sid);
    ordered.push(sid);
    if (ordered.length >= LAST_N_SCENARIOS) break;
  }
  return ordered;
}

async function syncMirrorPoolForUser(client: SupabaseClient, userId: string): Promise<void> {
  const origins = await lastDistinctScenarioIds(client, userId);
  const desired = new Set(origins);

  if (origins.length === 0) {
    const { error: delErr } = await client.from("mirror_scenario_pool").delete().eq("user_id", userId);
    if (delErr) throw new Error(delErr.message);
    return;
  }

  for (const originScenarioId of origins) {
    const targetRole = inferMirrorTargetRole(originScenarioId);
    const b = buildMirrorCopyBilingual(originScenarioId, targetRole);
    const { error: upErr } = await client.from("mirror_scenario_pool").upsert(
      {
        user_id: userId,
        scenario_type: MIRROR_POOL_SCENARIO_TYPE_CATALOG,
        air_delta: MIRROR_POOL_AIR_DELTA_NEUTRAL,
        origin_scenario_id: originScenarioId,
        target_role: targetRole,
        mirror_title: b.mirror_title,
        mirror_context: b.mirror_context,
        mirror_title_ko: b.mirror_title_ko,
        mirror_context_ko: b.mirror_context_ko,
        mirror_choices: b.mirror_choices,
        origin_choice_id: null,
      },
      { onConflict: "user_id,origin_scenario_id" },
    );
    if (upErr) throw new Error(upErr.message);
  }

  const { data: existing, error: exErr } = await client
    .from("mirror_scenario_pool")
    .select("id, origin_scenario_id")
    .eq("user_id", userId);

  if (exErr) throw new Error(exErr.message);

  for (const row of existing ?? []) {
    const oid = row.origin_scenario_id as string;
    if (!desired.has(oid)) {
      const { error: dErr } = await client.from("mirror_scenario_pool").delete().eq("id", row.id);
      if (dErr) throw new Error(dErr.message);
    }
  }
}

/**
 * 최근 Arena 선택 3건을 반영해 `mirror_scenario_pool`을 동기화한 뒤, 해당 사용자의 미러 행을 반환한다.
 */
export async function getMirrorScenarios(
  userId: string,
  supabase?: SupabaseClient,
): Promise<MirrorScenario[]> {
  const client = resolveMirrorDbClient(supabase);
  await syncMirrorPoolForUser(client, userId);

  const { data, error } = await client
    .from("mirror_scenario_pool")
    .select(
      "id, user_id, origin_scenario_id, target_role, mirror_title, mirror_context, mirror_title_ko, mirror_context_ko, mirror_choices, origin_choice_id, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as MirrorScenario[];
}

/**
 * Upsert one mirror pool row for an origin scenario + confirmed choice (bilingual + {@link MirrorChoiceSnapshot}).
 * Call when CHOICE_CONFIRMED warrants a fresh mirror (e.g. HERO_TRAP / INTEGRITY_SLIP).
 */
export type GenerateMirrorOptions = {
  /**
   * When set, copy comes from {@link getRoleMirrorScenario} (curated bilingual pool + LRU),
   * and `originScenarioId` is ignored for body/title (still used only if caller checks existence).
   */
  originFlagType?: string;
};

export async function generateMirror(
  userId: string,
  originScenarioId: string,
  choiceId: string,
  supabase?: SupabaseClient,
  options?: GenerateMirrorOptions,
): Promise<void> {
  const client = resolveMirrorDbClient(supabase);

  if (options?.originFlagType) {
    const rm = await getRoleMirrorScenario(userId, options.originFlagType, { supabase: client });
    const syntheticOrigin = `role_mirror:${rm.id}`;
    const { error } = await client.from("mirror_scenario_pool").upsert(
      {
        user_id: userId,
        scenario_type: MIRROR_POOL_SCENARIO_TYPE_ROLE_CURATED,
        air_delta: MIRROR_POOL_AIR_DELTA_NEUTRAL,
        origin_scenario_id: syntheticOrigin,
        target_role: rm.target_role,
        mirror_title: rm.title,
        mirror_context: rm.body,
        mirror_title_ko: rm.titleKo,
        mirror_context_ko: rm.bodyKo,
        mirror_choices: [],
        origin_choice_id: choiceId,
      },
      { onConflict: "user_id,origin_scenario_id" },
    );
    if (error) throw new Error(error.message);
    return;
  }

  if (!getScenarioById(originScenarioId)) {
    throw new Error(`generateMirror: unknown scenario ${originScenarioId}`);
  }
  const targetRole = inferMirrorTargetRole(originScenarioId);
  const b = buildMirrorCopyBilingual(originScenarioId, targetRole, { originChoiceId: choiceId });

  const { error } = await client.from("mirror_scenario_pool").upsert(
    {
      user_id: userId,
      scenario_type: MIRROR_POOL_SCENARIO_TYPE_CATALOG,
      air_delta: MIRROR_POOL_AIR_DELTA_NEUTRAL,
      origin_scenario_id: originScenarioId,
      target_role: targetRole,
      mirror_title: b.mirror_title,
      mirror_context: b.mirror_context,
      mirror_title_ko: b.mirror_title_ko,
      mirror_context_ko: b.mirror_context_ko,
      mirror_choices: b.mirror_choices,
      origin_choice_id: choiceId,
    },
    { onConflict: "user_id,origin_scenario_id" },
  );
  if (error) throw new Error(error.message);
}
