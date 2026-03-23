/**
 * Curated perspective-switch scenarios (8). Selection: next POV after last `perspective_switch_history`
 * row, then LRU among the two pool entries for that POV; each call inserts a history row.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Scenario, ScenarioChoice } from "@/lib/bty/scenario/types";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export type PerspectivePov = "subordinate" | "peer" | "client" | "observer";

export type PerspectiveSwitchPoolEntry = {
  id: string;
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
  pov: PerspectivePov;
  origin_flag_type: string;
  difficulty: 1 | 2 | 3;
};

export type PerspectiveSwitchScenario = PerspectiveSwitchPoolEntry;

/** Two entries per POV (8 total), bilingual. */
export const PERSPECTIVE_SWITCH_POOL: readonly PerspectiveSwitchPoolEntry[] = [
  {
    id: "ps_sub_1",
    titleKo: "상급자의 질책 이후",
    titleEn: "After feedback from a superior",
    bodyKo: "당신은 팀원입니다. 상급자가 공개적으로 업무를 지적했고, 당신은 당장의 반응을 고르고 있습니다.",
    bodyEn: "You are a team member. A superior publicly criticized your work; you choose your immediate response.",
    pov: "subordinate",
    origin_flag_type: "HERO_TRAP",
    difficulty: 2,
  },
  {
    id: "ps_sub_2",
    titleKo: "역할과 경계",
    titleEn: "Role and boundaries",
    bodyKo: "동료가 당신의 역할 밖 일을 요청했습니다. 거절과 관계 사이에서 균형을 잡아야 합니다.",
    bodyEn: "A peer asks you to do work outside your role. Balance refusal with relationship.",
    pov: "subordinate",
    origin_flag_type: "INTEGRITY_SLIP",
    difficulty: 2,
  },
  {
    id: "ps_peer_1",
    titleKo: "동료와의 갈등",
    titleEn: "Conflict with a peer",
    bodyKo: "같은 직급 동료가 자료 공유를 미루고 있습니다. 직접 대응할지, 상위에 올릴지.",
    bodyEn: "A peer delays sharing materials. Confront directly or escalate.",
    pov: "peer",
    origin_flag_type: "CLEAN",
    difficulty: 1,
  },
  {
    id: "ps_peer_2",
    titleKo: "신뢰 회복",
    titleEn: "Rebuilding trust",
    bodyKo: "약속을 어긴 동료에게 다시 맡길 수 있을지 판단해야 합니다.",
    bodyEn: "A peer broke a promise; you decide whether to trust them with the next task.",
    pov: "peer",
    origin_flag_type: "ROLE_MIRROR",
    difficulty: 2,
  },
  {
    id: "ps_client_1",
    titleKo: "환자의 거절",
    titleEn: "When the patient declines",
    bodyKo: "당신은 환자입니다. 권장 치료를 비용 때문에 거절했고, 진료자의 다음 말을 기다립니다.",
    bodyEn: "You are the patient. You declined recommended care due to cost; wait for the clinician’s next words.",
    pov: "client",
    origin_flag_type: "HERO_TRAP",
    difficulty: 2,
  },
  {
    id: "ps_client_2",
    titleKo: "정보와 불안",
    titleEn: "Information and anxiety",
    bodyKo: "검사 결과를 듣는 자리에서 추가 검사를 권해졌습니다. 질문과 감정을 다룹니다.",
    bodyEn: "You received test results and a suggestion for more tests; manage questions and fear.",
    pov: "client",
    origin_flag_type: "INTEGRITY_SLIP",
    difficulty: 3,
  },
  {
    id: "ps_obs_1",
    titleKo: "회의실의 긴장",
    titleEn: "Tension in the room",
    bodyKo: "당신은 관찰자입니다. 두 팀이 서로 다른 우선순위를 말하고 있으며, 개입은 최소입니다.",
    bodyEn: "You are an observer. Two teams state different priorities; intervention is minimal.",
    pov: "observer",
    origin_flag_type: "CLEAN",
    difficulty: 1,
  },
  {
    id: "ps_obs_2",
    titleKo: "조용한 신호",
    titleEn: "Quiet signals",
    bodyKo: "관찰자로서 비언어적 신호(침묵, 시선)만으로 상황을 정리합니다.",
    bodyEn: "As observer, summarize the situation using only nonverbal cues (silence, gaze).",
    pov: "observer",
    origin_flag_type: "ROLE_MIRROR",
    difficulty: 2,
  },
];

const POV_ORDER: readonly PerspectivePov[] = ['subordinate', 'peer', 'client', 'observer'] as const;

const POOL_BY_ID = new Map(PERSPECTIVE_SWITCH_POOL.map((p) => [p.id, p]));

function nextPov(last: PerspectivePov | null): PerspectivePov {
  if (!last) return 'subordinate';
  const i = POV_ORDER.indexOf(last);
  return POV_ORDER[(i + 1) % POV_ORDER.length]!;
}

function genericChoicesForDifficulty(difficulty: 1 | 2 | 3): ScenarioChoice[] {
  const d = difficulty === 1 ? 0.9 : difficulty === 2 ? 1.0 : 1.15;
  const base = {
    xpBase: 70,
    difficulty: d,
    hiddenDelta: { integrity: 1, communication: 1, insight: 1, resilience: 1, gratitude: 0 } as const,
    followUp: { enabled: false } as const,
  };
  const mk = (
    id: 'A' | 'B' | 'C' | 'D',
    label: string,
    labelKo: string,
    intent: string,
  ): ScenarioChoice => ({
    choiceId: id,
    label,
    labelKo,
    intent,
    ...base,
    result: 'Outcome recorded for perspective practice.',
    resultKo: '관점 전환 연습으로 결과가 기록되었습니다.',
    microInsight: 'Notice how POV changes what counts as success.',
    microInsightKo: '시점이 바뀌면 성공의 기준이 달라집니다.',
  });
  return [
    mk('A', 'Hold steady and name one fact.', '사실 한 가지를 짚고 침착을 유지한다.', 'Steady'),
    mk('B', 'Ask one clarifying question.', '명확히 하는 질문 하나를 한다.', 'Inquiry'),
    mk('C', 'Name impact and request a pause.', '영향을 말하고 잠시 멈출 것을 요청한다.', 'Boundary'),
    mk('D', 'Defer and document next step.', '미루고 다음 단계를 문서로 남긴다.', 'Defer'),
  ];
}

export function perspectiveSwitchToScenario(
  entry: PerspectiveSwitchPoolEntry,
  locale: 'ko' | 'en',
): Scenario {
  const title = locale === 'ko' ? entry.titleKo : entry.titleEn;
  const context = locale === 'ko' ? entry.bodyKo : entry.bodyEn;
  const flag = entry.origin_flag_type.toLowerCase();
  const train =
    flag.includes('integrity') ? 'integrity' :
    flag.includes('hero') ? 'communication' :
    flag.includes('mirror') || flag.includes('role') ? 'insight' :
    'resilience';

  return {
    scenarioId: `pswitch_${entry.id}`,
    title,
    context,
    titleKo: entry.titleKo,
    contextKo: entry.bodyKo,
    choices: genericChoicesForDifficulty(entry.difficulty),
    coachNotes: {
      whatThisTrains: [train],
      whyItMatters: 'Perspective-switch practice builds empathy and role clarity.',
    },
  };
}

export function getPerspectiveScenarioForSubmit(
  scenarioId: string,
  locale: 'ko' | 'en',
): Scenario | null {
  if (!scenarioId.startsWith('pswitch_')) return null;
  const poolId = scenarioId.slice('pswitch_'.length);
  const entry = POOL_BY_ID.get(poolId);
  if (!entry) return null;
  return perspectiveSwitchToScenario(entry, locale);
}

/**
 * Next POV from most recent history row; LRU among the two pool entries for that POV; persists to
 * `perspective_switch_history` before returning.
 */
export async function getNextPerspectiveSwitch(
  userId: string,
  supabase?: SupabaseClient,
): Promise<PerspectiveSwitchScenario> {
  const client = supabase ?? (await getSupabaseServerClient());

  const { data: histRows, error: hErr } = await client
    .from('perspective_switch_history')
    .select('pov, pool_entry_id, used_at')
    .eq('user_id', userId)
    .order('used_at', { ascending: false })
    .limit(50);

  const rows = hErr ? [] : (histRows ?? []);
  if (hErr) {
    console.warn('[getNextPerspectiveSwitch] hist', hErr.message);
  }

  const lastPov =
    rows.length > 0 ? ((rows[0] as { pov?: string }).pov as PerspectivePov | undefined) : null;
  const targetPov = nextPov(lastPov ?? null);

  const candidates = PERSPECTIVE_SWITCH_POOL.filter((p) => p.pov === targetPov);
  if (candidates.length === 0) {
    throw new Error(`[getNextPerspectiveSwitch] no pool entries for pov ${targetPov}`);
  }

  const lastUsed = new Map<string, number>();
  for (const id of candidates.map((c) => c.id)) {
    lastUsed.set(id, 0);
  }
  for (const raw of rows) {
    const row = raw as { pool_entry_id?: string; used_at?: string };
    const pid = row.pool_entry_id;
    if (!pid || !lastUsed.has(pid)) continue;
    const t = row.used_at ? new Date(row.used_at).getTime() : 0;
    const prev = lastUsed.get(pid) ?? 0;
    if (t > prev) lastUsed.set(pid, t);
  }

  let best = candidates[0]!;
  let bestScore = lastUsed.get(best.id) ?? 0;
  for (const c of candidates) {
    const sc = lastUsed.get(c.id) ?? 0;
    if (sc < bestScore) {
      bestScore = sc;
      best = c;
    }
  }

  const now = new Date().toISOString();
  const { error: insErr } = await client.from('perspective_switch_history').insert({
    user_id: userId,
    pool_entry_id: best.id,
    pov: best.pov,
    used_at: now,
  });
  if (insErr) {
    console.warn('[getNextPerspectiveSwitch] insert', insErr.message);
  }

  return best;
}
