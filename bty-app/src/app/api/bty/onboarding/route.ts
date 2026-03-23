/**
 * GET /api/bty/onboarding — {@link getOnboardingStep} for session user.
 * POST /api/bty/onboarding — `{ step: 1..5 }` → {@link markOnboardingStepComplete}.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getOnboardingStep,
  markOnboardingStepComplete,
  ONBOARDING_STEPS,
  type OnboardingStepNumber,
} from "@/engine/integration/onboarding-flow.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

function isStep(n: number): n is OnboardingStepNumber {
  return (ONBOARDING_STEPS as readonly number[]).includes(n);
}

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const supabase = await getSupabaseServerClient();
    const state = await getOnboardingStep(user.id, supabase);
    const res = NextResponse.json({ ok: true as const, ...state });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onboarding_get_failed";
    const res = NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}

export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const res = NextResponse.json({ ok: false as const, error: "INVALID_JSON" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const raw = typeof body === "object" && body && "step" in body ? (body as { step?: unknown }).step : null;
  const step = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(step) || !isStep(step)) {
    const res = NextResponse.json({ ok: false as const, error: "INVALID_STEP" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  try {
    const supabase = await getSupabaseServerClient();
    const state = await markOnboardingStepComplete(user.id, step, supabase);
    const res = NextResponse.json({ ok: true as const, ...state });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onboarding_mark_failed";
    const status = msg.includes("expected step") ? 409 : 500;
    const res = NextResponse.json({ ok: false as const, error: msg }, { status });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
