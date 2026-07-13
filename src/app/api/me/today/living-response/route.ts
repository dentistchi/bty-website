/**
 * /api/me/today/living-response — the immutable, same-day Living Response for today's commitment.
 *
 * GET: authenticate → resolve today's commitment → return the settled/pending response or null.
 *      NO generation, NO provider call.
 *
 * POST (fired by the client AFTER commitment confirmation; never blocks/undoes the commitment):
 *   authenticate → resolve commitment → acquire atomic claim →
 *     SETTLED/IN_PROGRESS → return canonical (0 provider calls) ;
 *     CLAIMED/RECLAIMED (we own it) → assemble provenance-safe evidence → admit →
 *       ineligible → settle deterministic fallback (0 provider calls) ;
 *       eligible → ONE generation → validate → generated | fallback → settle → return canonical.
 *
 * user is ALWAYS the authenticated id. Auth failures 401; persistence failures 503 (retryable).
 * The commitment POST is untouched and fast.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getTodayCommitmentRef } from "@/lib/bty/daily/todayRelationshipCommitment.server";
import { assembleLivingResponsePacket } from "@/lib/bty/daily/livingResponseEvidence.server";
import { admitLivingResponse } from "@/domain/daily/livingResponse";
import { deriveCommitmentFrame, selectProposition } from "@/domain/daily/livingResponseFrame";
import { generateLivingResponse } from "@/lib/bty/daily/livingResponseGenerate.server";
import { validateLivingResponse, LIVING_RESPONSE_POLICY_VERSION } from "@/lib/bty/daily/livingResponseValidator";
import { LIVING_RESPONSE_PROMPT_VERSION } from "@/lib/bty/daily/livingResponsePrompt";
import { selectFallbackLine, selectFrameFallbackLine } from "@/domain/daily/livingResponseFallback";
import { guardPhrasesFor } from "@/domain/daily/livingResponseGuardPhrases";
import {
  claimLivingResponse,
  getLivingResponseView,
  recentPerspectives,
  settleLivingResponse,
  type LivingResponseView,
} from "@/lib/bty/daily/livingResponse.server";

export const dynamic = "force-dynamic";

const noStore = (res: NextResponse) => {
  res.headers.set("Cache-Control", "no-store");
  return res;
};
const pendingView = (relationship: "self" | "others" | "world"): LivingResponseView => ({
  status: "pending",
  relationship,
  perspective: null,
  source: null,
  confidence: null,
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return noStore(NextResponse.json({ ok: false, code: "UNAUTHENTICATED" }, { status: 401 }));

    const admin = getSupabaseAdmin();
    if (!admin) return noStore(NextResponse.json({ ok: false, code: "UNAVAILABLE" }, { status: 503 }));

    const tz = req.nextUrl.searchParams.get("tz");
    const ref = await getTodayCommitmentRef(admin, user.id, new Date(), tz || null);
    if (!ref) return noStore(NextResponse.json({ ok: true, committed: false, response: null }, { status: 200 }));

    const response = await getLivingResponseView(admin, ref.id);
    return noStore(NextResponse.json({ ok: true, committed: true, response }, { status: 200 }));
  } catch {
    return noStore(NextResponse.json({ ok: false, code: "UNAVAILABLE" }, { status: 503 }));
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return noStore(NextResponse.json({ ok: false, code: "UNAUTHENTICATED" }, { status: 401 }));

    const admin = getSupabaseAdmin();
    if (!admin) return noStore(NextResponse.json({ ok: false, code: "UNAVAILABLE" }, { status: 503 }));

    const body = (await req.json().catch(() => null)) as { timeZone?: unknown } | null;
    const deviceTz = typeof body?.timeZone === "string" ? body.timeZone : null;
    const now = new Date();

    const ref = await getTodayCommitmentRef(admin, user.id, now, deviceTz);
    if (!ref) return noStore(NextResponse.json({ ok: false, code: "NO_COMMITMENT" }, { status: 409 }));

    const relationship = ref.relationship;
    const attemptToken = crypto.randomUUID();

    const claim = await claimLivingResponse(admin, {
      commitmentId: ref.id,
      userId: user.id,
      dayKey: ref.dayKey,
      relationship,
      promptVersion: LIVING_RESPONSE_PROMPT_VERSION,
      policyVersion: LIVING_RESPONSE_POLICY_VERSION,
      attemptToken,
    });

    if (claim === "SETTLED") {
      const response = await getLivingResponseView(admin, ref.id);
      return noStore(NextResponse.json({ ok: true, response }, { status: 200 }));
    }
    if (claim === "IN_PROGRESS") {
      return noStore(NextResponse.json({ ok: true, response: pendingView(relationship) }, { status: 200 }));
    }
    // CLAIMED | RECLAIMED → this attempt owns generation.

    // V2.1: the Commitment Frame is derived server-side from the canonical committed relationship
    // (never from Today Path / Promise text). Identical on every retry/reclaim from the immutable row.
    const frame = deriveCommitmentFrame(relationship);

    const nowIso = now.toISOString();
    // Frame-specific deterministic fallback FLOOR (movement-reflecting, replay-stable). Falls back to
    // the legacy per-relationship line only if the frame is somehow underivable (impossible for a
    // validated relationship, but never fabricate).
    const settleFallback = async (reason: string, fingerprint: string | null) => {
      const line = frame ? selectFrameFallbackLine(frame, ref.locale) : selectFallbackLine(relationship, ref.dayKey, ref.locale);
      return settleLivingResponse(
        admin,
        ref.id,
        attemptToken,
        { status: "fallback", perspective: line, source: "fallback", confidence: "limited", evidenceFingerprint: fingerprint, supportedCodes: [], modelVersion: null, lastErrorCode: reason },
        nowIso,
      );
    };

    // Assemble provenance-safe evidence (incl. derived frame) + admit (fail-closed → 0 provider calls).
    const packet = await assembleLivingResponsePacket(admin, user.id, ref, now);
    const admission = admitLivingResponse(packet);
    if (!admission.eligible) {
      const response = await settleFallback(admission.reason, packet.evidenceFingerprint);
      return noStore(NextResponse.json({ ok: true, response }, { status: 200 }));
    }

    // ONE admitted generation path. Build the ONE authorized proposition + selected angle server-side;
    // the provider only EXPRESSES it. Angle seed is stable per day+relationship (deterministic replay).
    const recent = await recentPerspectives(admin, user.id);
    const proposition = selectProposition(
      packet.commitmentFrame,
      admission.depth ?? "commitment",
      admission.qualifyingEvidenceCodes,
      `${ref.dayKey}:${relationship}`,
    );
    const gen = await generateLivingResponse(packet, { locale: ref.locale, recentTexts: recent, proposition });
    if (!gen.ok) {
      const reason = gen.reason === "LLM_UNAVAILABLE" ? "PROVIDER_UNAVAILABLE" : gen.reason === "BAD_JSON" ? "INVALID_OUTPUT" : "PROVIDER_TIMEOUT";
      const response = await settleFallback(reason, packet.evidenceFingerprint);
      return noStore(NextResponse.json({ ok: true, response }, { status: 200 }));
    }

    // Validate: any rejection (incl. generic wellness / missing frame anchor / historical / contrast)
    // → deterministic frame-specific fallback (no looser-retry).
    const validation = validateLivingResponse(gen.perspective, {
      relationship,
      guardPhrases: guardPhrasesFor(ref.locale, relationship),
      concepts: packet.concepts,
      recentTexts: recent,
      proposition,
    });
    if (!validation.ok) {
      const response = await settleFallback("POLICY_REJECTION", packet.evidenceFingerprint);
      return noStore(NextResponse.json({ ok: true, response }, { status: 200 }));
    }

    const response = await settleLivingResponse(
      admin,
      ref.id,
      attemptToken,
      { status: "generated", perspective: gen.perspective, source: "generated", confidence: "grounded", evidenceFingerprint: packet.evidenceFingerprint, supportedCodes: admission.qualifyingEvidenceCodes, modelVersion: gen.modelVersion, lastErrorCode: null },
      nowIso,
    );
    return noStore(NextResponse.json({ ok: true, response }, { status: 200 }));
  } catch {
    return noStore(NextResponse.json({ ok: false, code: "UNAVAILABLE" }, { status: 503 }));
  }
}
