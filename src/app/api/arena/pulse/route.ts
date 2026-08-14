import { NextRequest, NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

/**
 * POST /api/arena/pulse — P-A personal_responsibility_pulse capture.
 * Fired (once, optional/skippable) from the main-runtime action-loop terminal
 * (ArenaActionCompleted). user-session client => RLS insert_own (auth.uid() = user_id).
 * Single-field fire-and-forget; DB CHECK (pulse_value 1..5) is the hard backstop.
 * No auto-fill / no synthetic default — absence keeps LRI pending (DESIGN_V1 2/8).
 */
export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const pulseValue = b.pulse_value;
  if (
    typeof pulseValue !== "number" ||
    !Number.isInteger(pulseValue) ||
    pulseValue < 1 ||
    pulseValue > 5
  ) {
    return NextResponse.json(
      { error: "INVALID_PULSE_VALUE" },
      { status: 400 },
    );
  }

  const sessionId =
    typeof b.session_id === "string" && b.session_id.length > 0
      ? b.session_id
      : null;

  const { error } = await supabase.from("le_pulse_log").insert({
    user_id: user.id,
    pulse_value: pulseValue,
    session_id: sessionId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
