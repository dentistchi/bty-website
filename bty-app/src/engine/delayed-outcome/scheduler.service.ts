/**
 * Delayed outcome scheduler — 과거 Arena 선택(7일 이전)을 조회해 `arena_pending_outcomes`에 큐잉.
 * `choice_type`은 `meta.choice_type` 또는 `choice_id`/intent에서 유도해 outcome 템플릿과 매칭.
 *
 * @see docs/ENGINE_SCENARIO_FIT_AND_ROLES.md (choice_type · delayed_outcome)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

/** 스케줄러가 “과거”로 보는 최소 연령 (일). */
export const DELAYED_OUTCOME_MIN_AGE_DAYS = 7;

/** `arena_events.event_type` — 주요 선택 확정. */
export const ARENA_EVENT_TYPE_CHOICE_CONFIRMED = "CHOICE_CONFIRMED" as const;

export type OutcomeTemplate = {
  title: string;
  body: string;
};

/** 시나리오 엔진 문서의 choice_type 축을 기본 키로 사용; 미매칭은 `default`. */
export const DELAYED_OUTCOME_TEMPLATES: Record<string, OutcomeTemplate> = {
  direct_fix_or_takeover: {
    title: "지연 결과: 직접 수정·인수",
    body:
      "이전에 선택한 직접 개입·인수 패턴이 팀 역동에 남긴 여파를 다음 Arena 세션 프롬프트에 반영합니다.",
  },
  process_fix: {
    title: "지연 결과: 프로세스 정비",
    body:
      "과거에 고른 프로세스 중심 수정이 이후 상황에 어떻게 이어지는지 다음 세션에서 짧게 점검합니다.",
  },
  delegate_with_checkpoint: {
    title: "지연 결과: 위임과 체크포인트",
    body:
      "위임과 체크포인트 선택 이력을 바탕으로 후속 확인 질문을 다음 세션에 삽입합니다.",
  },
  withdraw: {
    title: "지연 결과: 철수·보류",
    body: "철수·보류 선택 이후의 리스크를 다음 세션 맥락에 연결합니다.",
  },
  reset_relationship: {
    title: "지연 결과: 관계 리셋",
    body: "관계 리셋 방향 선택에 따른 후속 신호를 다음 세션에 노출합니다.",
  },
  cynicism_or_lower_expectations: {
    title: "지연 결과: 기대 조정",
    body: "냉소·기대 하향 패턴을 다음 세션 자기 점검 문장으로 연결합니다.",
  },
  default: {
    title: "지연 결과: 과거 선택과의 연결",
    body: "과거 Arena 선택과 연결된 후속 맥락을 다음 세션에 주입합니다.",
  },
};

function templateForChoiceType(choiceType: string): OutcomeTemplate {
  return DELAYED_OUTCOME_TEMPLATES[choiceType] ?? DELAYED_OUTCOME_TEMPLATES.default;
}

function metaRecord(meta: unknown): Record<string, unknown> {
  return meta != null && typeof meta === "object" && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

/**
 * `arena_events` 행에서 스케줄용 choice_type 키를 유도한다.
 * - 우선 `meta.choice_type`
 * - 없으면 `meta.intent` 접두
 * - 없으면 `choice_id`의 첫 세그먼트(알파벳·숫자·`_`만)
 */
export function resolveChoiceTypeFromArenaEvent(row: {
  choice_id: string | null;
  meta: unknown;
}): string {
  const m = metaRecord(row.meta);
  const fromMeta = m.choice_type;
  if (typeof fromMeta === "string" && fromMeta.trim() !== "") {
    return fromMeta.trim();
  }
  const intent = m.intent;
  if (typeof intent === "string" && intent.trim() !== "") {
    return `intent_${intent.trim()}`;
  }
  if (row.choice_id && typeof row.choice_id === "string") {
    const seg = row.choice_id.split(/[:/]/)[0]?.replace(/[^a-zA-Z0-9_]/g, "") ?? "";
    if (seg) return seg.toLowerCase();
  }
  return "unknown_choice";
}

function cutoffIsoUtc(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

/**
 * `created_at`이 **지금으로부터 `DELAYED_OUTCOME_MIN_AGE_DAYS`일 이전**인 `CHOICE_CONFIRMED` 이벤트를 읽어
 * `arena_pending_outcomes`에 **아직 없는** 행만 삽입한다.
 *
 * @returns 새로 큐에 넣은 건수.
 */
export async function scheduleDelayedOutcomesForUser(
  userId: string,
  supabase?: SupabaseClient,
): Promise<number> {
  const client = supabase ?? (await getSupabaseServerClient());
  const cutoff = cutoffIsoUtc(DELAYED_OUTCOME_MIN_AGE_DAYS);

  const { data: events, error: evErr } = await client
    .from("arena_events")
    .select("event_id, choice_id, meta, created_at")
    .eq("user_id", userId)
    .eq("event_type", ARENA_EVENT_TYPE_CHOICE_CONFIRMED)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(100);

  if (evErr) throw new Error(evErr.message);
  if (!events?.length) return 0;

  let inserted = 0;
  for (const raw of events) {
    const row = raw as {
      event_id: string;
      choice_id: string | null;
      meta: unknown;
    };
    const choiceType = resolveChoiceTypeFromArenaEvent(row);
    const tpl = templateForChoiceType(choiceType);

    const { data: existing } = await client
      .from("arena_pending_outcomes")
      .select("id")
      .eq("user_id", userId)
      .eq("source_event_id", row.event_id)
      .maybeSingle();

    if (existing) continue;

    const { error: insErr } = await client.from("arena_pending_outcomes").insert({
      user_id: userId,
      source_event_id: row.event_id,
      choice_type: choiceType,
      outcome_title: tpl.title,
      outcome_body: tpl.body,
      status: "pending",
    });

    if (insErr) {
      if (insErr.code === "23505") continue;
      throw new Error(insErr.message);
    }
    inserted += 1;
  }

  return inserted;
}
