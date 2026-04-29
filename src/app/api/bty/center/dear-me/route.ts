/**
 * GET /api/bty/center/dear-me — {@link getDearMePrompt} + letter list (title + written_at).
 * POST — submit body (100–1000 chars) + prompt_type; refresh recommendation; optional slip recovery.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getDearMePrompt,
  refreshDearMeRecommendation,
  type DearMePromptType,
} from "@/engine/foundry/dear-me-recommender.service";
import { markRecoveryComplete } from "@/engine/integrity/slip-recovery.service";
import { getDearMePromptTextKo } from "@/lib/bty/center/dearMePromptKo";
import { getLetterHistory, submitLetter } from "@/lib/bty/center/letterService";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

const PROMPT_TYPES: readonly DearMePromptType[] = ["first_letter", "reflection_check", "awakening_letter", "none"];

const MIN_LEN = 100;
const MAX_LEN = 1000;

function letterTitle(body: string): string {
  const line = body.trim().split(/\n/)[0]?.trim() ?? "";
  if (!line) return "…";
  return line.length > 80 ? `${line.slice(0, 80)}…` : line;
}

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const prompt = await getDearMePrompt(user.id, supabase);
    const promptTextKo = getDearMePromptTextKo(prompt.prompt_type);

    const hist = await getLetterHistory(supabase, user.id, 30);
    if (!hist.ok) {
      const res = NextResponse.json({ ok: false as const, error: hist.error }, { status: 500 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    const letters = hist.letters.map((l) => ({
      id: l.id,
      title: letterTitle(l.body),
      written_at: l.createdAt,
    }));

    const res = NextResponse.json({
      ok: true as const,
      prompt: {
        prompt_type: prompt.prompt_type,
        healingPhase: prompt.healingPhase,
        letterCount: prompt.letterCount,
        lastWrittenAt: prompt.lastWrittenAt,
        recommendedAt: prompt.recommendedAt,
      },
      promptTextKo,
      letters,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const res = NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}

export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const body = (await req.json().catch(() => ({}))) as {
      body?: unknown;
      prompt_type?: unknown;
    };
    const raw = typeof body.body === "string" ? body.body.trim() : "";
    const pt =
      typeof body.prompt_type === "string" && (PROMPT_TYPES as readonly string[]).includes(body.prompt_type)
        ? (body.prompt_type as DearMePromptType)
        : null;

    if (!pt) {
      const res = NextResponse.json({ ok: false as const, error: "prompt_type_invalid" }, { status: 400 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }
    if (raw.length < MIN_LEN) {
      const res = NextResponse.json({ ok: false as const, error: "body_too_short" }, { status: 400 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }
    if (raw.length > MAX_LEN) {
      const res = NextResponse.json({ ok: false as const, error: "body_too_long" }, { status: 400 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    const submitted = await submitLetter(supabase, {
      userId: user.id,
      body: raw,
      useLlm: true,
    });

    if (!submitted.ok) {
      const res = NextResponse.json(
        { ok: false as const, error: submitted.error },
        { status: submitted.error === "text_too_long" ? 400 : 400 },
      );
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    await refreshDearMeRecommendation(user.id, supabase);

    const { data: pending } = await supabase
      .from("slip_recovery_tasks")
      .select("id")
      .eq("user_id", user.id)
      .eq("task_type", "reflection_letter")
      .is("completed_at", null)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const taskId =
      pending && typeof (pending as { id?: unknown }).id === "string"
        ? (pending as { id: string }).id
        : null;

    if (taskId) {
      await markRecoveryComplete(user.id, taskId);
    }

    const res = NextResponse.json({
      ok: true as const,
      letterId: submitted.letterId,
      reply: submitted.reply,
      prompt_type: pt,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const res = NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
