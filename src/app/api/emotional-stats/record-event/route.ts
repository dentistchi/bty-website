import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import type { EmotionalEventId } from "@/lib/bty/emotional-stats/coreStats";
import { EVENT_IDS } from "@/lib/bty/emotional-stats/coreStats";
import { recordEmotionalEventServer } from "@/lib/bty/emotional-stats/recordEmotionalEventServer";

function isValidEventId(id: string): id is EmotionalEventId {
  return (EVENT_IDS as readonly string[]).includes(id);
}

export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: { event_id?: string; session_id?: string };
  try {
    body = await req.json();
  } catch {
    const out = NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const eventId = typeof body.event_id === "string" ? body.event_id.trim() : "";
  if (!eventId || !isValidEventId(eventId)) {
    const out = NextResponse.json({ error: "Missing or invalid event_id" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const sessionId = typeof body.session_id === "string" ? body.session_id.trim() || null : null;

  const result = await recordEmotionalEventServer(
    supabase,
    user.id,
    eventId as EmotionalEventId,
    sessionId
  );

  if (!result.ok) {
    const out = NextResponse.json({ error: "Failed to record event" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const out = NextResponse.json({
    ok: true,
    ...(result.message_key && { message_key: result.message_key }),
  });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
