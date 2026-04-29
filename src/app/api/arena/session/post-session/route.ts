import { NextRequest, NextResponse } from "next/server";
import {
  routePostSession,
  type SessionOutcome,
} from "@/engine/integration/post-session-router";
import { ScenarioSelectionError } from "@/engine/scenario/scenario-selector.service";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import type { ScenarioLocalePreference } from "@/engine/scenario/scenario-selector.service";

export const runtime = "nodejs";

function parseSessionOutcome(body: unknown): SessionOutcome | null {
  if (body === null || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const dismissal = b.dismissal === "foundry_redirect" ? "foundry_redirect" : "next_scenario";
  const locale: ScenarioLocalePreference = b.locale === "ko" ? "ko" : "en";
  const foundryUnlockFired = b.foundryUnlockFired === true;
  const avatarTierUpgradedFired = b.avatarTierUpgradedFired === true;
  const airDelta = typeof b.airDelta === "number" && Number.isFinite(b.airDelta) ? b.airDelta : NaN;
  if (Number.isNaN(airDelta)) return null;
  return {
    dismissal,
    locale,
    foundryUnlockFired,
    avatarTierUpgradedFired,
    airDelta,
  };
}

/**
 * POST /api/arena/session/post-session — body matches {@link SessionOutcome} → {@link routePostSession}.
 */
export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const outcome = parseSessionOutcome(body);
  if (!outcome) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  try {
    const route = await routePostSession(user.id, outcome);
    const res = NextResponse.json({ ok: true, ...route });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    if (e instanceof ScenarioSelectionError && e.code === "user_ejected_from_arena") {
      const res = NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: 403 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }
    const msg = e instanceof Error ? e.message : "post_session_failed";
    const res = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
