import { createHmac } from "node:crypto";

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
