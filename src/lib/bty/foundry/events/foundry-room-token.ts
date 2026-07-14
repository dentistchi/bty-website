import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Foundry Room join token — a signed **capability** for the public QR/deep-link.
 *
 * This reuses the same HMAC-SHA256 / base64url / timingSafeEqual **approach** as
 * the Reality Event token (`btyev1`, `src/lib/bty/event-qr/event-qr-token.ts`)
 * but is its own family with a distinct prefix and payload. It does NOT import
 * or modify that module. (Per `.claude/rules/api-handlers.md`, the arena
 * `/qr/validate` endpoint is only for arena tokens; established second/third QR
 * families verify their own tokens — this is the third, for Foundry rooms.)
 *
 * Wire format: `btyfr1.<base64url(json)>.<base64url(hmac-sha256)>`
 *
 * The token is **stateless** — nothing is stored per token. It carries the event
 * id and a `joinVersion`; the DB row (`foundry_events.join_version` + `status`)
 * is the authority re-checked at every use. Rotating the QR = incrementing the
 * event's `join_version`, which makes every previously-minted token's version
 * stale (rejected). Because the token is derived from the row (not stored), the
 * manager can always re-mint and re-display the current QR after a refresh.
 */
export type FoundryRoomTokenPayload = {
  type: "foundry_room";
  eventId: string;
  joinVersion: number;
  iat: number; // epoch ms at mint (diagnostic; not used for expiry)
};

/** Token prefix — distinct from `btyev1` (event) and `aalo1` (arena action). */
export const FOUNDRY_ROOM_TOKEN_PREFIX = "btyfr1";

/**
 * Secret resolution. Prefers a dedicated `FOUNDRY_ROOM_QR_SECRET` so Foundry
 * room tokens can be rotated independently, but falls back to the existing QR
 * secret chain so no new env var is required to ship V1.
 */
function resolveFoundryRoomSecret(): string {
  const s =
    process.env.FOUNDRY_ROOM_QR_SECRET ??
    process.env.EVENT_QR_SECRET ??
    process.env.ARENA_ACTION_LOOP_QR_SECRET ??
    process.env.CRON_SECRET;
  if (!s?.trim()) {
    throw new Error(
      "FOUNDRY_ROOM_QR_SECRET or EVENT_QR_SECRET or ARENA_ACTION_LOOP_QR_SECRET or CRON_SECRET must be set",
    );
  }
  return s;
}

/** Mint a signed Foundry room join token for the QR / public deep link. */
export function signFoundryRoomToken(payload: FoundryRoomTokenPayload): string {
  const json = JSON.stringify(payload);
  const secret = resolveFoundryRoomSecret();
  const sig = createHmac("sha256", secret).update(json).digest("base64url");
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  return `${FOUNDRY_ROOM_TOKEN_PREFIX}.${b64}.${sig}`;
}

export type VerifyFoundryRoomTokenResult =
  | { ok: true; payload: FoundryRoomTokenPayload }
  | { ok: false; reason: string };

/**
 * Verify HMAC + parse JSON + payload shape. Does NOT use session cookies (the
 * caller is an anonymous employee). Does NOT check event existence/status/version
 * — that is the service layer's job against the DB row. Returns a stable machine
 * reason on failure; never echoes the token.
 */
export function verifyFoundryRoomToken(token: string): VerifyFoundryRoomTokenResult {
  const trimmed = typeof token === "string" ? token.trim() : "";
  if (!trimmed) return { ok: false, reason: "invalid_token" };

  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== FOUNDRY_ROOM_TOKEN_PREFIX) {
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
    secret = resolveFoundryRoomSecret();
  } catch {
    return { ok: false, reason: "server_misconfigured" };
  }

  const expectedSig = createHmac("sha256", secret).update(json).digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: FoundryRoomTokenPayload;
  try {
    payload = JSON.parse(json) as FoundryRoomTokenPayload;
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }

  if (
    payload.type !== "foundry_room" ||
    typeof payload.eventId !== "string" ||
    payload.eventId.length < 1 ||
    typeof payload.joinVersion !== "number" ||
    !Number.isInteger(payload.joinVersion) ||
    typeof payload.iat !== "number"
  ) {
    return { ok: false, reason: "invalid_payload" };
  }

  return { ok: true, payload };
}
