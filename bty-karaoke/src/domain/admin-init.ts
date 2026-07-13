// Pure decision for how the Admin Console should initialize from a stored device
// credential. A VALID admin device session always takes precedence; the PIN
// enrollment form appears ONLY when there is no stored credential or the server
// definitively rejects it (401 = revoked/invalid). A transient error (network /
// slow fetch / 5xx) must NEVER surface the PIN form — the console retries.

/** Result of probing /admin/session with a stored credential. */
export type SessionProbe = 'ok' | 'unauth' | 'neterr';

export type AdminInit =
  | 'authed' // valid session — enter the console
  | 'need-auth' // no cred, or a definitive 401 — show the PIN enrollment form
  | 'retry'; // transient failure — keep the cred, stay on loading, retry

export function adminInitFromProbe(hasCred: boolean, probe: SessionProbe | null): AdminInit {
  if (!hasCred) return 'need-auth';
  switch (probe) {
    case 'ok':
      return 'authed';
    case 'unauth':
      return 'need-auth';
    default:
      return 'retry'; // 'neterr' or not-yet-probed — never the PIN form
  }
}
