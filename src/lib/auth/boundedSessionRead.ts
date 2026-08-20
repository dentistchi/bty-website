/**
 * BOUNDED AUTH BOOT READS — a bound that expires means "we don't know" (Slice R4-R4B-R1).
 *
 * WHAT WAS MEASURED. Every request on the app's boot path was unbounded: `AuthContext.refresh()`
 * → `fetchSessionOnce()` → `fetchJson("/api/auth/session")`, and on native a second
 * `fetch("/api/auth/session")` inside `restoreNativeSession()`. None carried an `AbortController`,
 * a `signal`, or a timeout. `AuthContext` clears `loading` only inside a `finally`, so a request
 * that never SETTLES never clears it — and `/start` renders its navy surface for as long as
 * `loading` is true. The Founder's app sat on that screen with no error and nothing to press,
 * because the failure never arrived to be handled.
 *
 * THE RULE THIS FILE ENFORCES, AND IT IS THE SAME ONE R4-R2G/H/I/J ESTABLISHED FOR LEARNERS:
 * a bound that expires reports that we DO NOT KNOW. It is not a "no" from the server. Treating a
 * timeout as unauthenticated would sign a legitimately signed-in person out of a working account
 * because their network hiccuped — a far worse outcome than offering them a retry.
 *
 * So the timeout is reported as a distinct outcome that the caller must handle deliberately, and
 * nothing here clears a cookie, drops a session, or redirects.
 */

/** 12s: long enough for a cold WKWebView on a slow connection, short enough to not read as frozen. */
export const AUTH_BOOT_TIMEOUT_MS = 12_000;

/** Thrown ONLY when our own bound expired — never when the server answered. */
export class AuthReadTimeout extends Error {
  readonly timedOut = true as const;
  constructor() {
    super("auth_read_timeout");
    this.name = "AuthReadTimeout";
  }
}

/**
 * THE SAME MEANING, ARRIVING A DIFFERENT WAY.
 *
 * The bound above catches SILENCE. It does not catch a request that fails instantly, and that is
 * the more common failure by far: airplane mode, no signal, DNS, a connection reset, a 502 from the
 * edge. `fetchJson` CATCHES those and RESOLVES `{ ok: false, status: 0 }` — a value, not a
 * rejection — so they slipped past `readWithBound` entirely and were read as "the server said there
 * is no session".
 *
 * It said nothing. This subclass carries the identical "we do not know" meaning, so every caller
 * that already handles an expired bound handles this too without a second branch to keep in step.
 */
export class AuthReadUnreachable extends AuthReadTimeout {
  constructor(readonly status: number) {
    super();
    this.name = "AuthReadUnreachable";
    this.message = `auth_read_unreachable_${status}`;
  }
}

/**
 * Statuses that are not an answer ABOUT THE SESSION.
 *
 * `0` is `fetchJson`'s own sentinel, set in its catch and nowhere else — the request never reached
 * a server. `5xx` is the server failing rather than replying "no session". A `401`, and a `200`
 * carrying `ok:false`, ARE answers and stay answers: they mean signed out, and this must never
 * blur that, or a genuinely expired session would present as a network problem forever.
 */
export function isUnreachableStatus(status: number | undefined): boolean {
  return status === 0 || (typeof status === "number" && status >= 500);
}

/** True when this error came from our bound expiring, rather than from any server reply. */
export function isAuthReadTimeout(e: unknown): boolean {
  return (
    e instanceof AuthReadTimeout ||
    (typeof e === "object" && e !== null && (e as { timedOut?: unknown }).timedOut === true)
  );
}

/**
 * An `AbortSignal` that fires after `ms`, plus the cleanup that cancels the timer.
 *
 * The timer is cleared by the caller on settle so a fast response does not leave a pending timeout
 * alive for twelve seconds — which on a boot path that can run several times would otherwise pile
 * up handles for no reason.
 */
export function authTimeoutSignal(ms: number = AUTH_BOOT_TIMEOUT_MS): {
  signal: AbortSignal;
  done: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

/**
 * Run one bounded boot read.
 *
 * Resolves with the value on success. Throws `AuthReadTimeout` when OUR bound expired, and
 * re-throws anything else untouched — a 500, a parse failure and a dropped connection are all
 * still real answers about the request, and only the timeout carries the "we don't know" meaning.
 */
export async function readWithBound<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number = AUTH_BOOT_TIMEOUT_MS,
): Promise<T> {
  /*
    RACED, NOT MERELY SIGNALLED.

    The first version of this only handed `signal` to the runner and converted an abort when the
    runner REJECTED. That quietly assumes the runner honours the signal — and a runner that does
    not would hang exactly as before, which is the whole defect this file exists to remove. A
    regression here caught it: a promise that never settles ignored the abort entirely and the
    bound did nothing.

    So the timeout is a real competitor in a race. The signal is still passed, because a `fetch`
    that honours it should stop doing work rather than be abandoned — but settlement no longer
    DEPENDS on it.
  */
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AuthReadTimeout());
    }, ms);
  });

  try {
    return await Promise.race([run(controller.signal), expiry]);
  } catch (e) {
    // An abort raised by OUR controller is our timeout; anything else is a real answer.
    if (controller.signal.aborted && !isAuthReadTimeout(e)) throw new AuthReadTimeout();
    throw e;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
