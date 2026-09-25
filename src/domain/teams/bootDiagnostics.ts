/**
 * TEAMS BOOT DIAGNOSTICS — the vocabulary and the bounds. PURE.
 * Slice B: Teams Boot Observability + Host Handshake.
 *
 * ★ WHY THIS EXISTS. When the Teams host showed "we can't open the BTY app right now", nothing in
 * the product could say which step failed. The client reported a step name to `console.error` and
 * the Worker has no log retention, so `import_teams_js`, `app_initialize`, `get_auth_token`, the
 * bootstrap HTTP call and `set_session` were all indistinguishable after the fact. This module
 * names the stages so the NEXT occurrence is attributable, and bounds the two awaits that could
 * hang forever so there is a failure to attribute at all.
 *
 * ★ IT CARRIES NO CREDENTIAL, EVER. A boot timeline is a sequence of stage names and elapsed
 * milliseconds. There is no field for a token, a JWT, a cookie, an email, a UPN or user text, and
 * `redactErrorClass` below reduces a thrown value to a short symbolic class rather than a message —
 * because an SDK or fetch error message is the one place a URL or an identifier tends to appear.
 */

/** Every stage a boot attempt can report. Ordered as a healthy boot traverses them. */
export const BOOT_STAGES = [
  "shell_start",
  "teams_sdk_import_start",
  "teams_sdk_import_success",
  "teams_sdk_import_failure",
  "app_initialize_start",
  "app_initialize_success",
  "app_initialize_failure",
  "app_initialize_timeout",
  "get_auth_token_start",
  "get_auth_token_success",
  "get_auth_token_failure",
  "get_auth_token_timeout",
  "bootstrap_http_start",
  "bootstrap_http_response",
  "bootstrap_http_failure",
  "set_session_start",
  "set_session_success",
  "set_session_failure",
  "react_ready",
  "notify_success_sent",
  "notify_success_failure",
] as const;
export type BootStage = (typeof BOOT_STAGES)[number];

export const isBootStage = (v: unknown): v is BootStage =>
  typeof v === "string" && (BOOT_STAGES as readonly string[]).includes(v);

/**
 * THE TWO BOUNDS, AND WHY THESE NUMBERS.
 *
 * Neither `app.initialize()` nor `authentication.getAuthToken()` carries a documented timeout in
 * `@microsoft/teams-js` 2.55.0, and Microsoft does not publish the host's own tab-load window — so
 * these are chosen, not derived, and the reasoning is written down rather than implied.
 *
 * The constraint that matters is a RACE: whoever fails first owns the screen. If the host's window
 * expires first the learner gets a dead end with a retry that cannot help, because the app is still
 * waiting on a promise that will never settle. If BTY fails first the learner gets BTY's own screen,
 * a real retry, and a recorded stage. So the total pre-bootstrap bound is kept comfortably under the
 * smallest host window commonly observed for a tab load (~15s):
 *
 *   initialize   5s  — an in-frame postMessage handshake. A host that has not answered in five
 *                      seconds is not answering; this is not a network call.
 *   getAuthToken 7s  — may involve a silent Entra round trip, so it earns more than the handshake.
 *                      ─────
 *   total       12s  — under the host window, and under this shell's own 15.5s retry ladder.
 *
 * Raise these only with device evidence about the host window, never to make a hang "pass".
 */
export const APP_INITIALIZE_TIMEOUT_MS = 5_000;
export const GET_AUTH_TOKEN_TIMEOUT_MS = 7_000;
export const TOTAL_PRE_BOOTSTRAP_BUDGET_MS = APP_INITIALIZE_TIMEOUT_MS + GET_AUTH_TOKEN_TIMEOUT_MS;

/** One recorded transition. `elapsedMs` is measured from `shell_start`, never a wall clock. */
export type BootEvent = { stage: BootStage; elapsedMs: number; errorClass?: string };

export type BootTimeline = {
  bootAttemptId: string;
  /** Terminal stage the attempt stopped at — what a reader wants first. */
  terminalStage: BootStage;
  events: BootEvent[];
  /** Release identity, when the runtime already exposes one. Never invented. */
  buildSha?: string | null;
  /** Coarse runtime classification only — never a full user agent. */
  platform?: string | null;
};

/** A timeline is bounded: a boot cannot report more transitions than there are stages. */
export const MAX_BOOT_EVENTS = BOOT_STAGES.length;

/**
 * Reduce ANY thrown value to a short symbolic class.
 *
 * An error message is where a URL, a tenant id or an identifier leaks, so the message is discarded
 * and only a constructor-ish name survives — allow-listed by grammar rather than by trimming, which
 * is the mistake a length filter makes with a compact JSON body.
 */
export function redactErrorClass(e: unknown): string {
  const raw =
    e instanceof Error && typeof e.name === "string" && e.name
      ? e.name
      : typeof e === "string"
        ? e
        : typeof e === "object" && e !== null && typeof (e as { name?: unknown }).name === "string"
          ? String((e as { name: string }).name)
          : "UnknownError";
  const v = raw.trim().slice(0, 40);
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(v) ? v : "UnknownError";
}

/** Coarse runtime class. Deliberately not the user agent. */
export function platformClass(ua: string | null | undefined): string {
  const s = (ua ?? "").toLowerCase();
  if (!s) return "unknown";
  const os = /iphone|ipad|ipod/.test(s) ? "ios" : /android/.test(s) ? "android" : /mac os x/.test(s) ? "macos" : /windows/.test(s) ? "windows" : "other";
  return `${os}${/teams/.test(s) ? "-teams" : ""}`;
}

/**
 * Validate a timeline arriving from a client. NOTHING is trusted: an unknown stage, a non-finite
 * elapsed, an over-long list or an unexpected key is dropped rather than stored.
 *
 * Returns null when there is nothing worth recording, so the caller writes no row at all.
 */
export function readBootTimeline(raw: unknown): BootTimeline | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.bootAttemptId === "string" ? r.bootAttemptId.trim() : "";
  // A client-generated correlation id, constrained to a shape that cannot smuggle anything.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  if (!isBootStage(r.terminalStage)) return null;

  const events: BootEvent[] = [];
  for (const e of Array.isArray(r.events) ? r.events.slice(0, MAX_BOOT_EVENTS) : []) {
    if (!e || typeof e !== "object") continue;
    const ev = e as Record<string, unknown>;
    if (!isBootStage(ev.stage)) continue;
    const ms = typeof ev.elapsedMs === "number" && Number.isFinite(ev.elapsedMs) ? Math.max(0, Math.round(ev.elapsedMs)) : null;
    if (ms === null) continue;
    const cls = typeof ev.errorClass === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(ev.errorClass) ? ev.errorClass.slice(0, 40) : undefined;
    events.push(cls ? { stage: ev.stage, elapsedMs: ms, errorClass: cls } : { stage: ev.stage, elapsedMs: ms });
  }
  if (events.length === 0) return null;

  const sha = typeof r.buildSha === "string" && /^[0-9a-f]{40}$/.test(r.buildSha) ? r.buildSha : null;
  const plat = typeof r.platform === "string" && /^[a-z-]{1,24}$/.test(r.platform) ? r.platform : null;
  return { bootAttemptId: id, terminalStage: r.terminalStage, events, buildSha: sha, platform: plat };
}
