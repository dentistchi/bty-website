/**
 * AI PATIENT — sealed session state.
 *
 * V1 persists nothing: no transcript row, no audio, no session table. The whole session — hidden
 * concern, transcript, deadline, owner — travels with the client as ONE authenticated-encrypted blob
 * (AES-256-GCM). The client can hold it and send it back, but cannot read the hidden concern or alter
 * a single turn: any change fails decryption and the request is refused.
 *
 * Uses WebCrypto (available in Node and the Workers runtime). The key comes from the dedicated
 * `AI_PATIENT_SESSION_SECRET`; deployed environments have no fallback, mirroring the Foundry room
 * secret. The value is never logged.
 */

import type { AiPatientSessionState } from "@/domain/arena/aiPatient/sessionRules";
import { isValidSessionCase } from "@/domain/arena/aiPatient/scenarios";

export const SEAL_PREFIX = "aps1";
const KEY_CONTEXT = "bty-ai-patient-session-v1";

function isProdEnv(): boolean {
  const env = process.env.BTY_ENV;
  return env === "production" || env === "staging";
}

export class AiPatientConfigError extends Error {
  readonly name = "AiPatientConfigError";
}

/** Dedicated secret; in local/test only, an existing dev secret is accepted so tests need no new variable. */
export function resolveAiPatientSecret(): string {
  const dedicated = process.env.AI_PATIENT_SESSION_SECRET;
  if (dedicated?.trim()) return dedicated;
  if (isProdEnv()) throw new AiPatientConfigError(`AI_PATIENT_SESSION_SECRET is required in ${process.env.BTY_ENV}.`);
  const dev = process.env.CRON_SECRET ?? process.env.FOUNDRY_ROOM_QR_SECRET ?? process.env.EVENT_QR_SECRET;
  if (!dev?.trim()) throw new AiPatientConfigError("AI_PATIENT_SESSION_SECRET must be set.");
  return dev;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64url = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string): Uint8Array<ArrayBuffer> => {
  const raw = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  out.set(raw);
  return out;
};

async function key(): Promise<CryptoKey> {
  const material = await crypto.subtle.digest("SHA-256", enc.encode(`${resolveAiPatientSecret()}|${KEY_CONTEXT}`));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function sealSession(state: AiPatientSessionState): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(SEAL_PREFIX) }, await key(), enc.encode(JSON.stringify(state))));
  return `${SEAL_PREFIX}.${b64url(iv)}.${b64url(ct)}`;
}

export type UnsealResult = { ok: true; state: AiPatientSessionState } | { ok: false; reason: "malformed" | "tampered" | "not_owner" };

/** Open a sealed session for `userId`. A session belongs to the person who started it, and only them. */
export async function unsealSession(sealed: unknown, userId: string): Promise<UnsealResult> {
  if (typeof sealed !== "string" || sealed.length > 200_000) return { ok: false, reason: "malformed" };
  const parts = sealed.split(".");
  if (parts.length !== 3 || parts[0] !== SEAL_PREFIX) return { ok: false, reason: "malformed" };
  let plain: string;
  try {
    const iv = fromB64url(parts[1]!);
    if (iv.length !== 12) return { ok: false, reason: "malformed" };
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: enc.encode(SEAL_PREFIX) }, await key(), fromB64url(parts[2]!));
    plain = dec.decode(pt);
  } catch (e) {
    if (e instanceof AiPatientConfigError) throw e;
    return { ok: false, reason: "tampered" };
  }
  let state: AiPatientSessionState;
  try {
    state = JSON.parse(plain) as AiPatientSessionState;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (state?.v !== 1 || !isValidSessionCase(state.caseId, state.concern) || !Array.isArray(state.turns)) return { ok: false, reason: "malformed" };
  if (state.uid !== userId) return { ok: false, reason: "not_owner" };
  return { ok: true, state };
}
