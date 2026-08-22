// BUILD 26U-R2 — RELEASE COMPATIBILITY: which contract the server projects for a caller.
//
// PURE — no DB, no network, no clock, no framework.
//
// ── THE PROBLEM THIS SOLVES ────────────────────────────────────────────────────────────────
// BTY Norebang v1.0 build 109 is public on the App Store and is FREE. It was approved and
// installed under a promise that hosted rooms cost nothing. That binary is immutable: it can
// never be taught about Premium Room, and it has no purchase surface it could offer. If the
// R1 server change were deployed with no compatibility layer, build 109 would start receiving
// 402 `PREMIUM_ROOM_REQUIRED` for an action it has always been allowed to perform.
//
// ── THE ONE THING THIS MODULE IS NOT ───────────────────────────────────────────────────────
// A CLIENT VERSION IS NOT ENTITLEMENT AUTHORITY. Nothing here can create, grant, extend or
// imply a paid entitlement. `build >= 110 → entitled` is not expressible in this file, and
// neither is `build 109 → grant`. What a version selects is which RELEASE CONTRACT the server
// projects during a migration window — legacy-free hosted rooms, or Premium Room. Entitlement
// itself stays exactly where R1 put it:
//
//     verified Apple purchase → fulfilled timed grant → active entitlement → hosted Event
//
// The `legacy` contract does not activate a pass, does not create a grant, and does not mark
// anyone entitled. It only declines to ASK for entitlement. That distinction is what makes a
// spoofable header tolerable here and unacceptable anywhere else.
//
// ── THE HEADER IS CLIENT-ASSERTED AND THEREFORE SPOOFABLE ──────────────────────────────────
// `X-BTY-Client` is sent by the client and can be forged or omitted by anyone with curl. It is
// NOT a security boundary and must never be described as one. Under DUAL, omitting it yields
// the legacy free contract — i.e. a free hosted room. That is a real, deliberate, bounded hole:
//   * it can never produce financial value (no grant, no activation, no entitlement);
//   * it exists only while the rollout mode is DUAL;
//   * it closes completely at PREMIUM_ALL, where an unidentified client is refused outright;
//   * every classification is counted, so the window can be closed on evidence.

/** The rollout state. Exactly one is in force at a time, server-wide. */
export const ROLLOUT_MODES = ['legacy_free', 'dual', 'premium_all'] as const;
export type RolloutMode = (typeof ROLLOUT_MODES)[number];

/** The safe default whenever the mode cannot be read: behave exactly like the live v1.0 system. */
export const DEFAULT_ROLLOUT_MODE: RolloutMode = 'legacy_free';

/**
 * The first native build that understands Premium Room. Build 109 is the public v1.0 binary;
 * 110 is the first v1.1 candidate. A native build BELOW this is legacy by definition.
 */
export const FIRST_PREMIUM_NATIVE_BUILD = 110;

/** The header name. One header, one meaning, both clients. */
export const CLIENT_HEADER = 'x-bty-client';

/**
 * What the server believes it is talking to.
 *
 * `web` carries no build gate because the web app is CONTINUOUSLY DEPLOYED: a browser always
 * loads the bundle the current server serves, so there is no immutable-binary debt to service.
 * The legacy exception exists solely for a client that CANNOT be updated, which is why it is
 * keyed on native build number and not on platform preference.
 */
export type ClientRelease =
  | { kind: 'native'; build: number }
  | { kind: 'web' }
  /** No usable `X-BTY-Client`: build 109, a script, curl, or a malformed value. */
  | { kind: 'unidentified' };

/** The contract the server will project for this caller. */
export type ReleaseContract =
  /** Pre-R1 behaviour: a hosted session needs no entitlement and activates no pass. */
  | 'legacy'
  /** R1 behaviour: a hosted session requires Premium Room entitlement. */
  | 'premium'
  /** The client is too old for the current mode and must be updated. Explicit, never silent. */
  | 'unsupported';

const NATIVE_RE = /^native\/(\d{1,9})$/;
const WEB_RE = /^web\/[A-Za-z0-9._-]{1,64}$/;

/**
 * Parse `X-BTY-Client`. Accepts exactly two shapes and nothing else:
 *
 *     native/<build>     a positive integer CFBundleVersion
 *     web/<buildId>      the NEXT_PUBLIC_KARAOKE_BUILD the tab is running
 *
 * ANYTHING else — absent, empty, malformed, a float, a negative, an unknown platform, a value
 * that is too long — is `unidentified`. It is deliberately NOT lenient: a permissive parser here
 * would let a typo silently select a contract, and the whole point of this module is that the
 * selection is explicit.
 */
export function parseClientRelease(raw: string | null | undefined): ClientRelease {
  if (typeof raw !== 'string') return { kind: 'unidentified' };
  const v = raw.trim().toLowerCase();
  if (v.length === 0 || v.length > 80) return { kind: 'unidentified' };

  const native = NATIVE_RE.exec(v);
  if (native) {
    const build = Number(native[1]);
    if (!Number.isSafeInteger(build) || build <= 0) return { kind: 'unidentified' };
    return { kind: 'native', build };
  }
  if (WEB_RE.test(v)) return { kind: 'web' };
  return { kind: 'unidentified' };
}

/** Coerce any stored value to a valid mode. Unknown → the safe legacy default, never premium. */
export function normalizeRolloutMode(v: unknown): RolloutMode {
  return typeof v === 'string' && (ROLLOUT_MODES as readonly string[]).includes(v)
    ? (v as RolloutMode)
    : DEFAULT_ROLLOUT_MODE;
}

/**
 * THE MATRIX. One total function, no other place decides this.
 *
 *                     | native >= 110 | native < 110 | web      | unidentified
 *   ------------------+---------------+--------------+----------+--------------
 *   legacy_free       | legacy        | legacy       | legacy   | legacy
 *   dual              | premium       | legacy       | premium  | legacy
 *   premium_all       | premium       | unsupported  | premium  | unsupported
 *
 * WHY `legacy_free` IS TOTAL. It is the deploy-safe state: with the mode at `legacy_free`, the
 * R1 + R2 server can be deployed and NOTHING changes for anybody, on any client. The rollout is
 * then a data flip, not a deploy — which is what makes it reversible in seconds.
 *
 * WHY WEB IS `premium` UNDER `dual`. Web has no immutable binary. Granting it the legacy
 * exception would be the "native pays / web stays free" bypass, and — because web is the surface
 * with no App Store review gate — it would be the easiest path around the product. It is
 * therefore held to the same authority as native v1.1 from the moment DUAL begins.
 *
 * WHY `unidentified` IS `legacy` UNDER `dual`. Build 109 sends no header and cannot be changed,
 * so under DUAL an absent header MUST mean legacy or the public app breaks. The cost is stated
 * at the top of this file: it is spoofable, it yields no financial value, and it ends at
 * PREMIUM_ALL.
 */
export function resolveReleaseContract(mode: RolloutMode, client: ClientRelease): ReleaseContract {
  if (mode === 'legacy_free') return 'legacy';

  const isPremiumCapable =
    client.kind === 'web' || (client.kind === 'native' && client.build >= FIRST_PREMIUM_NATIVE_BUILD);

  if (isPremiumCapable) return 'premium';
  // Not premium-capable: an old native build, or a caller we cannot identify.
  return mode === 'dual' ? 'legacy' : 'unsupported';
}

/**
 * The telemetry bucket for one resolution. Coarse ON PURPOSE: it answers "how much build-109
 * traffic is left?" and nothing else. It carries no account, room, event, token, IP or device
 * id, so it can be retained indefinitely without becoming a privacy liability.
 */
export const RELEASE_CLIENT_BUCKETS = [
  'NATIVE_LEGACY',
  'NATIVE_PREMIUM',
  'WEB',
  'UNIDENTIFIED',
] as const;
export type ReleaseClientBucket = (typeof RELEASE_CLIENT_BUCKETS)[number];

export function releaseClientBucket(client: ClientRelease): ReleaseClientBucket {
  switch (client.kind) {
    case 'web':
      return 'WEB';
    case 'native':
      return client.build >= FIRST_PREMIUM_NATIVE_BUILD ? 'NATIVE_PREMIUM' : 'NATIVE_LEGACY';
    case 'unidentified':
      return 'UNIDENTIFIED';
  }
}

/**
 * The refusal a client too old for the current mode receives. Explicit and machine-readable —
 * never a silent hard failure, and never a payment message: this client cannot pay, it can only
 * update, so telling it about money would be both useless and untrue.
 */
export const CLIENT_UPDATE_REQUIRED_CODE = 'CLIENT_UPDATE_REQUIRED';
export const CLIENT_UPDATE_REQUIRED_KO =
  '앱을 최신 버전으로 업데이트해 주세요. 노래 검색과 YouTube에서 열기는 계속 사용할 수 있어요.';
