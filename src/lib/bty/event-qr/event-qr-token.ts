import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Reality Event QR token — the **second** official QR family (separate from the
 * Action Loop `aalo1` token in `arena-action-loop-token.ts`). This module reuses
 * the same HMAC-SHA256 / base64url / timingSafeEqual crypto **approach** but with
 * an Event-specific payload + distinct prefix; it does NOT import or modify the
 * Action token module (expanded-invariant decision: Event validate is its own
 * family, not an Action overload).
 *
 * Wire format: `btyev1.<base64url(json)>.<base64url(hmac-sha256)>`
 */
export type EventQrTokenPayload = {
  type: "event";
  eventId: string;
  issuedBy: string; // creator_id (leader-track user who minted the event)
  issuedAt: number; // epoch ms at mint
  exp: number; // epoch ms expiry (= event.valid_until)
};

/** Token prefix — distinct from the Action token's `aalo1`. */
export const EVENT_QR_TOKEN_PREFIX = "btyev1";

/**
 * Secret resolution. Prefers a dedicated `EVENT_QR_SECRET` so Event tokens can be
 * rotated independently of Action tokens, but falls back to the existing QR secret
 * chain so no new env var is required to ship Slice 2a.
 */
function resolveEventQrSecret(): string {
  const s =
    process.env.EVENT_QR_SECRET ??
    process.env.ARENA_ACTION_LOOP_QR_SECRET ??
    process.env.CRON_SECRET;
  if (!s?.trim()) {
    throw new Error("EVENT_QR_SECRET or ARENA_ACTION_LOOP_QR_SECRET or CRON_SECRET must be set");
  }
  return s;
}

/** Mint opaque signed Event token for QR / deep link (scan flow consumes it in a later slice). */
export function signEventQrToken(payload: EventQrTokenPayload): string {
  const json = JSON.stringify(payload);
  const secret = resolveEventQrSecret();
  const sig = createHmac("sha256", secret).update(json).digest("base64url");
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  return `${EVENT_QR_TOKEN_PREFIX}.${b64}.${sig}`;
}

export type VerifyEventQrTokenResult =
  | { ok: true; payload: EventQrTokenPayload }
  | { ok: false; reason: string };

/**
 * Verify HMAC + parse JSON + expiry. Does not use session cookies — caller may be a
 * different user (the scanning participant). **Defined now for completeness; the
 * scan route that consumes it is a later slice (Slice 2b), not this creation slice.**
 */
export function verifyEventQrToken(token: string): VerifyEventQrTokenResult {
  const trimmed = token?.trim();
  if (!trimmed) return { ok: false, reason: "invalid_token" };

  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== EVENT_QR_TOKEN_PREFIX) {
    return { ok: false, reason: "invalid_token" };
  }

  const [, b64, sig] = parts;
  if (!b64 || !sig) return { ok: false, reason: "invalid_token" };

  let json: string;
  try {
    json = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return { ok: false, reason: "invalid_token" };
  }

  let secret: string;
  try {
    secret = resolveEventQrSecret();
  } catch {
    return { ok: false, reason: "server_misconfigured" };
  }

  const expectedSig = createHmac("sha256", secret).update(json).digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: EventQrTokenPayload;
  try {
    payload = JSON.parse(json) as EventQrTokenPayload;
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }

  if (
    payload.type !== "event" ||
    typeof payload.eventId !== "string" ||
    typeof payload.issuedBy !== "string" ||
    typeof payload.issuedAt !== "number" ||
    typeof payload.exp !== "number"
  ) {
    return { ok: false, reason: "invalid_payload" };
  }

  if (!Number.isFinite(payload.exp) || Date.now() > payload.exp) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload };
}
