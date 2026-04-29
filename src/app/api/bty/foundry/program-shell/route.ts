/**
 * GET /api/bty/foundry/program-shell?programId=&lang= — progress + catalog (modules, phase tags) + Dojo CTA hints.
 */
import { NextRequest, NextResponse } from "next/server";
import type { DojoSkillArea } from "@/engine/foundry/dojo-assessment.service";
import { weakestSkillAreaFromScenarioStats } from "@/engine/foundry/dojo-assessment.service";
import {
  getProgramProgress,
  recordProgramSelected,
} from "@/engine/foundry/program-completion.service";
import { getScenarioStats } from "@/engine/scenario/scenario-stats.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

const SKILL: readonly DojoSkillArea[] = [
  "communication",
  "decision",
  "resilience",
  "integrity",
  "leadership",
  "empathy",
];

function parseModules(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  return [];
}

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const programId = req.nextUrl.searchParams.get("programId")?.trim() ?? "";
  const lang = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "ko";
  if (!programId) {
    const res = NextResponse.json({ ok: false as const, error: "MISSING_PROGRAM_ID" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  try {
    const supabase = await getSupabaseServerClient();

    let progress = await getProgramProgress(user.id, programId, supabase);
    if (!progress) {
      progress = await recordProgramSelected(user.id, programId, supabase);
    }

    const { data: cat, error: catErr } = await supabase
      .from("program_catalog")
      .select("title, phase_tags, modules, skill_area")
      .eq("program_id", programId)
      .maybeSingle();

    if (catErr) {
      const res = NextResponse.json({ ok: false as const, error: catErr.message }, { status: 500 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }
    if (!cat) {
      const res = NextResponse.json({ ok: false as const, error: "PROGRAM_NOT_FOUND" }, { status: 404 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    let modules = parseModules((cat as { modules?: unknown }).modules);
    if (modules.length === 0) {
      modules = lang === "ko" ? ["모듈 1", "모듈 2", "모듈 3"] : ["Module 1", "Module 2", "Module 3"];
    }

    const rawSkill = (cat as { skill_area?: unknown }).skill_area;
    const skill_area =
      typeof rawSkill === "string" && (SKILL as readonly string[]).includes(rawSkill)
        ? (rawSkill as DojoSkillArea)
        : null;

    const phase_tags = Array.isArray((cat as { phase_tags?: unknown }).phase_tags)
      ? ((cat as { phase_tags: string[] }).phase_tags as string[])
      : [];

    const stats = await getScenarioStats(user.id, lang);
    const weakest_skill_area = weakestSkillAreaFromScenarioStats(stats);

    const { data: pending } = await supabase
      .from("slip_recovery_tasks")
      .select("id")
      .eq("user_id", user.id)
      .eq("task_type", "dojo_assessment")
      .is("completed_at", null)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pending_dojo_assessment_task_id =
      pending && typeof (pending as { id?: unknown }).id === "string"
        ? (pending as { id: string }).id
        : null;

    const show_dojo_assessment_cta = Boolean(
      pending_dojo_assessment_task_id &&
        skill_area != null &&
        skill_area === weakest_skill_area,
    );

    const res = NextResponse.json({
      ok: true as const,
      userId: user.id,
      progress,
      catalog: {
        title: typeof (cat as { title?: unknown }).title === "string" ? (cat as { title: string }).title : programId,
        phase_tags,
        modules,
        skill_area,
      },
      weakest_skill_area,
      pending_dojo_assessment_task_id,
      show_dojo_assessment_cta,
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
