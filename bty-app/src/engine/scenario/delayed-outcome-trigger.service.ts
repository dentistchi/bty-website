/**
 * 7-day delayed Arena outcomes from `user_scenario_choice_history` → `arena_pending_outcomes`.
 * Templates keyed by normalized `flag_type` (4 buckets) × variant from `scenario_type` (2 per flag).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export const DELAYED_OUTCOME_DELAY_DAYS = 7 as const;

export type MentorFlagBucket = "HERO_TRAP" | "INTEGRITY_SLIP" | "CLEAN" | "ROLE_MIRROR";

export type DelayedOutcomeTemplate = {
  id: string;
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
};

/** Two templates per flag bucket (8 total), bilingual. */
export const DELAYED_OUTCOME_TEMPLATES: Record<
  MentorFlagBucket,
  readonly [DelayedOutcomeTemplate, DelayedOutcomeTemplate]
> = {
  HERO_TRAP: [
    {
      id: "hero_trap_followup_0",
      titleKo: "지연 결과 · 영웅 역할의 여파",
      titleEn: "Delayed outcome · Aftermath of the hero move",
      bodyKo:
        "일주일 전 Arena에서 빠르게 뛰어든 선택이 팀에 남긴 신호를 짧게 점검합니다. 다음 세션에서 ‘누가 주인공이었는지’를 다시 맞춰 보세요.",
      bodyEn:
        "We revisit how last week’s fast takeover landed with the team. In your next session, realign who owns the next move.",
    },
    {
      id: "hero_trap_followup_1",
      titleKo: "지연 결과 · 속도 vs 공감",
      titleEn: "Delayed outcome · Speed vs empathy",
      bodyKo:
        "당시에는 정답처럼 보였던 개입이 관계 온도에 어떤 영향을 줬는지 확인합니다. 이번 라운드는 질문 한 개로 시작해 보세요.",
      bodyEn:
        "Check how that decisive intervention affected trust. Open this round with one honest question before advising.",
    },
  ],
  INTEGRITY_SLIP: [
    {
      id: "integrity_slip_followup_0",
      titleKo: "지연 결과 · 기준선 다시 세우기",
      titleEn: "Delayed outcome · Resetting the line",
      bodyKo:
        "무결성 압박이 있었던 선택의 후속입니다. 지금은 ‘무엇을 지킬지’ 한 문장으로만 정의하고 플레이해 보세요.",
      bodyEn:
        "Follow-up from an integrity-pressured choice. Name one non‑negotiable line for this session in a single sentence.",
    },
    {
      id: "integrity_slip_followup_1",
      titleKo: "지연 결과 · 기록과 말의 정렬",
      titleEn: "Delayed outcome · Words vs record",
      bodyKo:
        "한 주가 지난 뒤, 말한 약속과 실제 행동 사이의 간극을 Arena에서 짧게 드러내 봅니다.",
      bodyEn:
        "A week later, surface any gap between what was said and what stuck—keep it brief and specific.",
    },
  ],
  CLEAN: [
    {
      id: "clean_followup_0",
      titleKo: "지연 결과 · 프로토콜의 힘",
      titleEn: "Delayed outcome · Power of protocol",
      bodyKo:
        "감정이 올라와도 절차를 지킨 그 선택의 뒷맛을 확인합니다. 같은 상황이면 무엇을 한 줄로 남길까요?",
      bodyEn:
        "You stayed clean under pressure. Reflect on what one line you’d repeat if the scene replayed tomorrow.",
    },
    {
      id: "clean_followup_1",
      titleKo: "지연 결과 · 안정 신호 유지",
      titleEn: "Delayed outcome · Keeping the steady signal",
      bodyKo:
        "차분한 대응이 팀에 준 ‘안전’ 메시지를 한 주 뒤에도 유지했는지 짧게 점검합니다.",
      bodyEn:
        "Check whether your calm signal still holds a week later—one concrete observation.",
    },
  ],
  ROLE_MIRROR: [
    {
      id: "role_mirror_followup_0",
      titleKo: "지연 결과 · 역할 반사",
      titleEn: "Delayed outcome · Role mirror",
      bodyKo:
        "상대 역할을 비추던 선택 이후, 관계에서 누가 말하고 누가 들었는지 다시 그려 봅니다.",
      bodyEn:
        "After mirroring roles, redraw who spoke and who listened—carry that into this session’s first beat.",
    },
    {
      id: "role_mirror_followup_1",
      titleKo: "지연 결과 · 관점 전환의 비용",
      titleEn: "Delayed outcome · Cost of reframing",
      bodyKo:
        "시점을 바꾼 대화가 남긴 감정 비용을 짚고, 이번엔 한 발짝만 다가가 보세요.",
      bodyEn:
        "Name the emotional cost of that reframe, then take one smaller step this time.",
    },
  ],
};

export type DelayedOutcome = {
  pendingOutcomeId: string;
  choiceHistoryId: string;
  scheduledFor: string;
  templateId: string;
  choiceTypeKey: string;
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
  /** Convenience for UI / prompts */
  title: string;
  body: string;
};

function normalizeFlagBucket(flagType: string): MentorFlagBucket {
  const u = (flagType ?? "").toUpperCase();
  if (u.includes("HERO_TRAP") || u.includes("HERO")) return "HERO_TRAP";
  if (u.includes("INTEGRITY_SLIP") || u.includes("INTEGRITY")) return "INTEGRITY_SLIP";
  if (u.includes("ROLE_MIRROR") || u.includes("MIRROR")) return "ROLE_MIRROR";
  if (u.includes("CLEAN")) return "CLEAN";
  return "CLEAN";
}

function variantIndexFromScenarioType(scenarioType: string): 0 | 1 {
  const s = scenarioType.trim();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h + s.charCodeAt(i)) % 2;
  }
  return h as 0 | 1;
}

export function pickDelayedOutcomeTemplate(
  flagType: string,
  scenarioType: string,
): DelayedOutcomeTemplate {
  const bucket = normalizeFlagBucket(flagType);
  const pair = DELAYED_OUTCOME_TEMPLATES[bucket];
  return pair[variantIndexFromScenarioType(scenarioType)]!;
}

function choiceTypeKey(flagType: string, scenarioType: string): string {
  const bucket = normalizeFlagBucket(flagType);
  const v = variantIndexFromScenarioType(scenarioType);
  return `delayed_${bucket}_v${v}`;
}

function addDaysUtc(iso: string, days: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function cutoffEligiblePlayedAt(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - DELAYED_OUTCOME_DELAY_DAYS);
  return d.toISOString();
}

type ChoiceHistoryRow = {
  id: string;
  scenario_id: string;
  choice_id: string;
  flag_type: string;
  played_at: string;
  scenario_type: string | null;
  outcome_triggered: boolean | null;
};

async function resolveScenarioTypeForRow(
  client: SupabaseClient,
  row: ChoiceHistoryRow,
): Promise<string> {
  if (typeof row.scenario_type === "string" && row.scenario_type.trim() !== "") {
    return row.scenario_type.trim();
  }
  const { data } = await client
    .from("scenarios")
    .select("scenario_type")
    .eq("id", row.scenario_id)
    .eq("locale", "en")
    .maybeSingle();
  const st = (data as { scenario_type?: string } | null)?.scenario_type;
  return typeof st === "string" && st.trim() !== "" ? st.trim() : "general";
}

/**
 * Finds `user_scenario_choice_history` rows at least {@link DELAYED_OUTCOME_DELAY_DAYS} old,
 * `outcome_triggered = false`, and inserts matching `arena_pending_outcomes` with
 * `scheduled_for = played_at + 7 days` when not already queued.
 */
export async function scheduleOutcomes(
  userId: string,
  supabase?: SupabaseClient,
): Promise<number> {
  const client = supabase ?? (await getSupabaseServerClient());
  const playedBefore = cutoffEligiblePlayedAt();

  const { data: rows, error } = await client
    .from("user_scenario_choice_history")
    .select("id, scenario_id, choice_id, flag_type, played_at, scenario_type, outcome_triggered")
    .eq("user_id", userId)
    .eq("outcome_triggered", false)
    .lt("played_at", playedBefore)
    .order("played_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  if (!rows?.length) return 0;

  let inserted = 0;
  for (const raw of rows) {
    const row = raw as ChoiceHistoryRow;
    const scenarioType = await resolveScenarioTypeForRow(client, row);
    const tpl = pickDelayedOutcomeTemplate(row.flag_type, scenarioType);
    const scheduledFor = addDaysUtc(row.played_at, DELAYED_OUTCOME_DELAY_DAYS);
    const ctKey = choiceTypeKey(row.flag_type, scenarioType);

    const { data: existing } = await client
      .from("arena_pending_outcomes")
      .select("id")
      .eq("user_id", userId)
      .eq("source_choice_history_id", row.id)
      .maybeSingle();

    if (existing) continue;

    const { error: insErr } = await client.from("arena_pending_outcomes").insert({
      user_id: userId,
      source_choice_history_id: row.id,
      source_event_id: null,
      choice_type: ctKey,
      outcome_title: tpl.titleKo,
      outcome_body: `${tpl.bodyKo}\n\n--- EN ---\n${tpl.bodyEn}`,
      status: "pending",
      scheduled_for: scheduledFor,
    });

    if (insErr) {
      if (insErr.code === "23505") continue;
      console.warn("[scheduleOutcomes] insert", insErr.message);
      continue;
    }
    inserted += 1;
  }

  return inserted;
}

function localizePendingRow(
  row: {
    id: string;
    source_choice_history_id: string | null;
    scheduled_for: string | null;
    choice_type: string;
    outcome_title: string;
    outcome_body: string;
  },
  locale: "ko" | "en",
): DelayedOutcome {
  const body = row.outcome_body ?? "";
  const enSep = "\n\n--- EN ---\n";
  let titleKo = row.outcome_title;
  let titleEn = row.outcome_title;
  let bodyKo = body;
  let bodyEn = body;
  if (body.includes(enSep)) {
    const [koPart, rest] = body.split(enSep);
    bodyKo = koPart.trim();
    bodyEn = rest.trim();
  } else {
    if (locale === "en") {
      bodyEn = body;
      bodyKo = body;
    }
  }

  const tplIdMatch = row.choice_type.match(/delayed_(\w+)_v(\d)/);
  const templateId = tplIdMatch ? `${tplIdMatch[1]}_v${tplIdMatch[2]}` : row.choice_type;

  const title = locale === "ko" ? titleKo : titleEn;
  const bodyOut = locale === "ko" ? bodyKo : bodyEn;

  return {
    pendingOutcomeId: row.id,
    choiceHistoryId: row.source_choice_history_id ?? "",
    scheduledFor: row.scheduled_for ?? new Date().toISOString(),
    templateId,
    choiceTypeKey: row.choice_type,
    titleKo,
    titleEn,
    bodyKo,
    bodyEn,
    title,
    body: bodyOut,
  };
}

/**
 * Due delayed outcomes: `status = pending`, `scheduled_for <= now`.
 */
export async function getDueOutcomes(
  userId: string,
  options?: { locale?: "ko" | "en"; supabase?: SupabaseClient; now?: Date },
): Promise<DelayedOutcome[]> {
  const client = options?.supabase ?? (await getSupabaseServerClient());
  const locale = options?.locale ?? "ko";
  const now = options?.now ?? new Date();
  const nowIso = now.toISOString();

  const { data, error } = await client
    .from("arena_pending_outcomes")
    .select(
      "id, source_choice_history_id, scheduled_for, choice_type, outcome_title, outcome_body, status",
    )
    .eq("user_id", userId)
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true });

  if (error) throw new Error(error.message);

  const out: DelayedOutcome[] = [];
  for (const raw of data ?? []) {
    const row = raw as {
      id: string;
      source_choice_history_id: string | null;
      scheduled_for: string | null;
      choice_type: string;
      outcome_title: string;
      outcome_body: string;
      status: string;
    };
    out.push(localizePendingRow(row, locale));
  }

  return out;
}

/**
 * After UI/session delivers outcomes: mark pending rows consumed and `outcome_triggered` on history.
 */
export async function markDueOutcomesDelivered(
  userId: string,
  pendingOutcomeIds: string[],
  supabase?: SupabaseClient,
): Promise<void> {
  if (pendingOutcomeIds.length === 0) return;
  const client = supabase ?? (await getSupabaseServerClient());
  const now = new Date().toISOString();

  const { data: rows, error: selErr } = await client
    .from("arena_pending_outcomes")
    .select("id, source_choice_history_id")
    .eq("user_id", userId)
    .in("id", pendingOutcomeIds);

  if (selErr) throw new Error(selErr.message);

  const historyIds = (rows ?? [])
    .map((r) => (r as { source_choice_history_id?: string }).source_choice_history_id)
    .filter((x): x is string => typeof x === "string" && x.length > 0);

  const { error: upErr } = await client
    .from("arena_pending_outcomes")
    .update({ status: "consumed", consumed_at: now, delivered_at: now })
    .eq("user_id", userId)
    .in("id", pendingOutcomeIds);

  if (upErr) throw new Error(upErr.message);

  if (historyIds.length > 0) {
    const { error: hErr } = await client
      .from("user_scenario_choice_history")
      .update({ outcome_triggered: true })
      .eq("user_id", userId)
      .in("id", historyIds);
    if (hErr) throw new Error(hErr.message);
  }
}
