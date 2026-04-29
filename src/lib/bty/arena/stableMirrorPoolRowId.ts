import { createHash } from "node:crypto";

/**
 * RFC 4122 UUID v5 (SHA-1) — deterministic `mirror_scenario_pool.id` per (user, origin).
 * Closes pool defect: rows recreated on re-sync no longer get new random UUIDs; `mirror:<id>` stays stable for the same origin.
 *
 * Namespace is a fixed BTY constant (not a secret).
 */
export const MIRROR_SCENARIO_POOL_ID_NAMESPACE = "a3b8c2d1-5e4f-4a6b-9c0d-1e2f3a4b5c6d";

/**
 * @param userId — auth user id
 * @param originScenarioId — `mirror_scenario_pool.origin_scenario_id` (catalog id or `role_mirror:<id>`)
 */
export function stableMirrorPoolRowId(userId: string, originScenarioId: string): string {
  const name = `${userId}\n${originScenarioId}`;
  return uuidV5(name, MIRROR_SCENARIO_POOL_ID_NAMESPACE);
}

function uuidV5(name: string, namespaceUuid: string): string {
  const nsHex = namespaceUuid.replace(/-/g, "");
  if (nsHex.length !== 32) throw new Error("uuidV5: namespace must be UUID");
  const nsBuf = Buffer.from(nsHex, "hex");
  const hash = createHash("sha1").update(Buffer.concat([nsBuf, Buffer.from(name, "utf8")])).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
