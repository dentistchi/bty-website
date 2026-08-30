/**
 * Microsoft identity → BTY identity (PURE). Slice R1C-B-2R.
 *
 * No I/O, no DB, no side effects. This module owns exactly one thing: what a *trusted* Microsoft
 * identity tuple looks like before anything is allowed to search for it.
 *
 * THE TUPLE IS `tid` + `oid`, AND NOTHING ELSE — proven experimentally in R1C-B-1a against a real
 * Microsoft-signed token:
 *
 *   PROVIDER_ID_EQUALS_SUB = true   · PROVIDER_ID_EQUALS_OID = false · SUB_EQUALS_OID = false
 *
 * Microsoft's own reference is the reason: `sub` is "a pairwise identifier and is unique to an
 * application ID", so the Supabase Azure app and a Teams Bot app receive DIFFERENT `sub` values for
 * the same human. `oid` is the one that "uniquely identifies the user across applications", and
 * `tid` scopes it to a tenant. Teams supplies exactly these two on every authenticated invoke, in
 * every scope, as `activity.from.aadObjectId` and `channelData.tenant.id`.
 *
 * EMAIL IS NEVER IDENTITY. Supabase's *automatic* OAuth linking does match on verified email
 * internally; that mechanism is explicitly NOT the Teams→BTY resolver and must never be reachable
 * from one. Under the Microsoft-first cutover a BTY account IS a Microsoft account, so identity is
 * established by signing in — never inferred from an address that happens to match.
 */

/** Entra emits `oid` and `tid` as GUIDs. Anything else is not a Microsoft identity tuple. */
const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export type MicrosoftIdentityTuple = { tenantId: string; aadObjectId: string };

export type MicrosoftIdentityInputResult =
  | { ok: true; tuple: MicrosoftIdentityTuple }
  | { ok: false; code: "invalid_tenant_id" | "invalid_aad_object_id" };

/**
 * Validate + normalise a claimed Microsoft identity tuple.
 *
 * Lower-cased because Entra GUIDs are case-insensitive but string comparison in SQL is not: a
 * Teams invoke and an OAuth id_token may differ only in case, and an unnormalised compare would
 * silently resolve to NOT_LINKED. The resolver normalises both sides of every comparison, so
 * casing can never decide identity.
 */
export function normalizeMicrosoftIdentity(
  tenantId: unknown,
  aadObjectId: unknown,
): MicrosoftIdentityInputResult {
  const tid = typeof tenantId === "string" ? tenantId.trim() : "";
  const oid = typeof aadObjectId === "string" ? aadObjectId.trim() : "";
  if (!GUID.test(tid)) return { ok: false, code: "invalid_tenant_id" };
  if (!GUID.test(oid)) return { ok: false, code: "invalid_aad_object_id" };
  return { ok: true, tuple: { tenantId: tid.toLowerCase(), aadObjectId: oid.toLowerCase() } };
}

/**
 * Resolution outcomes. `AMBIGUOUS_IDENTITY` exists because `auth.identities`' uniqueness is
 * `UNIQUE (provider_id, provider)` — i.e. on `sub`, which is per-application. Two Azure identities
 * could therefore share an `oid` if two different Entra apps were ever used. BTY uses one, so this
 * should be unreachable; it FAILS CLOSED rather than picking a winner, because guessing which
 * account owns an identity is the exact failure this whole series exists to prevent.
 */
export type MicrosoftIdentityResolution =
  | { status: "RESOLVED"; userId: string }
  | { status: "NOT_LINKED" }
  | { status: "AMBIGUOUS_IDENTITY"; matched: number }
  | { status: "INVALID_INPUT"; code: "invalid_tenant_id" | "invalid_aad_object_id" }
  | { status: "LOOKUP_FAILED" };

/** Pure mapping from a row count to a verdict. Never returns a user id it was not given. */
export function resolutionFromRows(rows: { userId: string }[]): MicrosoftIdentityResolution {
  if (rows.length === 0) return { status: "NOT_LINKED" };
  if (rows.length > 1) return { status: "AMBIGUOUS_IDENTITY", matched: rows.length };
  const id = (rows[0]?.userId ?? "").trim();
  return id ? { status: "RESOLVED", userId: id } : { status: "LOOKUP_FAILED" };
}
