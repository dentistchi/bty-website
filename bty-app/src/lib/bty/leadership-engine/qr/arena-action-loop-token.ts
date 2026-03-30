import { createHmac, timingSafeEqual } from "node:crypto";

/** Payload embedded in signed QR / deep-link token (validated on commit). */
export type ArenaActionLoopTokenPayload = {
  sessionId: string;
  userId: string;
  actionId: string;
  issuedAt: number;
  contractId?: string;
};

function resolveArenaActionLoopQrSecret(): string {
  const s = process.env.ARENA_ACTION_LOOP_QR_SECRET ?? process.env.CRON_SECRET;
  if (!s?.trim()) {
    throw new Error("ARENA_ACTION_LOOP_QR_SECRET or CRON_SECRET must be set");
  }
  return s;
}

/**
 * Mint opaque signed token for `aalo` query (My Page action-loop commit).
 * Format: `aalo1.<base64url(json)>.<base64url(hmac-sha256)>`
 */
export function signArenaActionLoopToken(payload: ArenaActionLoopTokenPayload): string {
  const json = JSON.stringify(payload);
  const secret = resolveArenaActionLoopQrSecret();
  const sig = createHmac("sha256", secret).update(json).digest("base64url");
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  return `aalo1.${b64}.${sig}`;
}

/** Max age for QR / deep-link token (witness may scan later; keep bounded). */
export const ARENA_ACTION_LOOP_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type VerifyArenaActionLoopTokenResult =
  | { ok: true; payload: ArenaActionLoopTokenPayload }
  | { ok: false; reason: string };

/**
 * Verify HMAC + parse JSON + TTL. Does not use session cookies — caller may be a different user (witness).
 */
export function verifyArenaActionLoopToken(token: string): VerifyArenaActionLoopTokenResult {
  const trimmed = token?.trim();
  if (!trimmed) return { ok: false, reason: "invalid_token" };

  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== "aalo1") {
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
    secret = resolveArenaActionLoopQrSecret();
  } catch {
    return { ok: false, reason: "server_misconfigured" };
  }

  const expectedSig = createHmac("sha256", secret).update(json).digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: ArenaActionLoopTokenPayload;
  try {
    payload = JSON.parse(json) as ArenaActionLoopTokenPayload;
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }

  if (
    typeof payload.sessionId !== "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.actionId !== "string" ||
    typeof payload.issuedAt !== "number"
  ) {
    return { ok: false, reason: "invalid_payload" };
  }

  const age = Date.now() - payload.issuedAt;
  if (!Number.isFinite(age) || age > ARENA_ACTION_LOOP_TOKEN_MAX_AGE_MS || age < -120_000) {
    return { ok: false, reason: "expired_or_clock_skew" };
  }

  return { ok: true, payload };
}
