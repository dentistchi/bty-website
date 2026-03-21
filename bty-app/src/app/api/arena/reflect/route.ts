/**
 * POST /api/arena/reflect — 성찰 심화 엔진 (Human Model; 계산은 `@/lib/bty/arena/reflection-engine`).
 *
 * @contract
 * - **Auth:** 401 `{ error: "UNAUTHENTICATED" }`.
 * - **Body (JSON):** `userText` string 필수(공백만 불가). 선택: `levelId` (S1|S2|S3|L1|L2|L3|L4),
 *   `locale` `"ko"` | 그 외→`en`, `scenario` 임의(JSON 직렬화 가능).
 * - **levelId 생략:** `GET /api/arena/unlocked-scenarios` 와 동일 테넌시(멤버십·L4)로 추론.
 * - **200:** `{ ok: true, summary: string, questions: string[], next_action: string, detected: { tags: string[], topTag: string } }`.
 * - **400:** `{ error: "Invalid JSON body" }` (JSON 파싱 실패) | `{ error: "userText is required" }` (`userText` 누락·공백만).
 * - **413:** `{ error: "USER_TEXT_TOO_LARGE" }` — trim 후 `userText.length` > `REFLECT_USER_TEXT_MAX_CHARS` (`reflectLimits.ts`, 24000).
 * - **249:** 위 400·413 응답은 **`error` 문자열 단일 키** (추가 필드 없음).
 * - **422:** 미사용. 플랫폼 전체 본문 한도 초과는 인프라 **413** 가능.
 *
 * @see docs/spec/ARENA_DOMAIN_SPEC.md §4-7
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getEffectiveTrack } from "@/lib/bty/arena/program";
import { getUnlockedContentWindow } from "@/lib/bty/arena/unlock";
import { buildReflection, type LevelId, type HumanModelConfig } from "@/lib/bty/arena/reflection-engine";
import humanModelJson from "@/lib/bty/arena/arena_human_model.json";
import { REFLECT_USER_TEXT_MAX_CHARS } from "@/lib/bty/arena/reflectLimits";
import { arenaReflectLevelIdFromUnknown } from "@/domain/arena/scenarios";

export const runtime = "nodejs";

const HUMAN_MODEL = humanModelJson as HumanModelConfig;

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: { levelId?: string; userText?: string; locale?: string; scenario?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const locale = body.locale === "ko" ? "ko" : "en";

  const userText = String(body.userText ?? "").trim();
  if (!userText) {
    return NextResponse.json({ error: "userText is required" }, { status: 400 });
  }
  if (userText.length > REFLECT_USER_TEXT_MAX_CHARS) {
    return NextResponse.json({ error: "USER_TEXT_TOO_LARGE" }, { status: 413 });
  }

  let levelId: LevelId;
  const parsedLevel = arenaReflectLevelIdFromUnknown(body.levelId);
  if (parsedLevel != null && HUMAN_MODEL.levels[parsedLevel]) {
    levelId = parsedLevel;
  } else {
    // Resolve from user tenure (same as GET /api/arena/unlocked-scenarios). Prefer arena_membership_requests.
    let joinedAt = user.created_at ?? new Date().toISOString();
    let leaderStartedAt: string | null = null;
    let jobFunction: string | null = null;

    const { data: arenaRequest } = await supabase
      .from("arena_membership_requests")
      .select("job_function, joined_at, leader_started_at, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (arenaRequest?.status === "approved") {
      if (arenaRequest.joined_at) joinedAt = new Date(arenaRequest.joined_at).toISOString();
      if (arenaRequest.leader_started_at) leaderStartedAt = new Date(arenaRequest.leader_started_at).toISOString();
      if (arenaRequest.job_function) jobFunction = arenaRequest.job_function;
    } else {
      const { data: membership } = await supabase
        .from("memberships")
        .select("created_at, role, job_function")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (membership?.created_at) joinedAt = membership.created_at;
      if (membership?.job_function) jobFunction = membership.job_function;
    }

    const track = getEffectiveTrack({
      jobFunction: jobFunction ?? undefined,
      membershipRole: undefined,
      joinedAt,
    });
    let l4Granted = false;
    const { data: profile } = await supabase
      .from("arena_profiles")
      .select("l4_access")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile && typeof (profile as { l4_access?: boolean }).l4_access === "boolean") {
      l4Granted = (profile as { l4_access: boolean }).l4_access;
    }
    const { maxUnlockedLevel } = getUnlockedContentWindow({
      track,
      user: { joinedAt, leaderStartedAt },
      now: new Date(),
      l4Granted,
      jobFunction: jobFunction ?? undefined,
    });
    // Human model has S1..L4; tenure returns S1..L3; L4 is admin-granted only.
    levelId = HUMAN_MODEL.levels[maxUnlockedLevel] ? maxUnlockedLevel as LevelId : "S1";
  }

  const scenario = body.scenario ?? undefined;
  const result = buildReflection(levelId, userText, HUMAN_MODEL, scenario, locale);

  return NextResponse.json({
    ok: true,
    summary: result.summary,
    questions: result.questions,
    next_action: result.next_action,
    detected: {
      tags: result.detected.tags,
      topTag: result.detected.topTag,
    },
  });
}
