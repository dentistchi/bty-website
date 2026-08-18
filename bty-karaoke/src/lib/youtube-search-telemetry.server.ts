// BUILD R2 — durable YouTube `search.list` quota telemetry.
//
// THE ONE RULE THIS MODULE EXISTS TO ENFORCE: a row in `karaoke_youtube_search_calls` means BTY
// actually issued one outbound `search.list` HTTP request, and therefore spent exactly one unit of
// the 1,000/day Search Queries allocation. A cache hit, an open breaker, a missing credential, a
// validation rejection, and a recommendation cache read are all ZERO quota and must never produce
// a row. `videos.list` belongs to a DIFFERENT bucket and has no path into this system at all —
// the table has no `endpoint` column to hold it.
//
// Two sinks, deliberately different shapes:
//   * recordOutboundSearchCall — one immutable row per real request (the quota truth).
//   * recordSearchServe        — an hourly counter per disposition (the efficiency denominator).
//     A visible search is only ever read in aggregate, so per-search rows would store far more
//     than the question needs.
//
// BEST-EFFORT AND FAIL-OPEN, without exception. A telemetry failure must never convert a
// successful guest search into an outage: every path here swallows its own errors and emits a
// bounded marker instead. Under-counting shows up as a discrepancy against Google Cloud Metrics,
// which is the reconciliation control; a blocked search would be a product regression.
//
// PRIVACY: nothing here accepts or stores a query, a biased query, a URL, an API key, a response
// payload, an account, room, session, guest name, IP, device id, or fingerprint. The recorded
// facts are the outcome, the upstream status/reason token, the latency, and the performance
// style — none of which identifies a person or a venue.

import type { PerformanceStyle } from '@/domain/performance-style';

/** How one VISIBLE search was served. Exactly one applies per `searchYoutubeWithCache` call. */
export type SearchServeDisposition = 'UPSTREAM' | 'CACHE_HIT' | 'BREAKER_OPEN' | 'GATED';

/** Outcome of one real outbound request. Mirrors the table's closed CHECK. */
export type SearchCallOutcome =
  | 'OK'
  | 'QUOTA_EXCEEDED'
  | 'HTTP_4XX'
  | 'HTTP_5XX'
  | 'NETWORK_ERROR';

export interface OutboundSearchCall {
  /** Minted BEFORE the fetch; makes the WRITE idempotent, never the call. */
  callId: string;
  outcome: SearchCallOutcome;
  httpStatus?: number | null;
  /** Google's classification token only (e.g. `quotaExceeded`), never a payload. */
  upstreamReason?: string | null;
  latencyMs?: number | null;
  style?: PerformanceStyle | null;
}

/**
 * Classify one upstream failure. PURE — no I/O, unit-tested directly.
 *
 * `quotaExceeded` is decided by the caller's existing classifier and wins outright: a daily-quota
 * refusal arrives as HTTP 403 or 429, and reporting it as a generic 4xx/5xx would erase the single
 * most important signal this system exists to capture.
 *
 * No status at all means the request never produced an HTTP response — DNS, TLS, timeout, abort.
 * That is NETWORK_ERROR, and it is deliberately NOT folded into 5xx: "YouTube answered with a
 * server error" and "we never reached YouTube" are different operational facts. Note that a
 * network failure may still have SPENT the unit (the request can reach Google before the response
 * is lost), which is exactly why it is recorded rather than dropped.
 */
export function classifySearchCallOutcome(
  status: number | undefined | null,
  quotaExceeded: boolean,
): SearchCallOutcome {
  if (quotaExceeded) return 'QUOTA_EXCEEDED';
  if (status == null || !Number.isFinite(status)) return 'NETWORK_ERROR';
  if (status >= 500) return 'HTTP_5XX';
  // Any other non-OK status (4xx, and the practically unreachable 3xx) is a client-side refusal.
  return 'HTTP_4XX';
}

/** Bounded diagnostic. Records WHICH sink failed and nothing else — never a query or a DB message. */
function logTelemetryFailure(sink: 'search_call' | 'search_serve'): void {
  try {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({ event: 'youtube_search_telemetry_write_failed', sink }));
  } catch {
    /* logging must never throw */
  }
}

/**
 * Resolve the Karaoke DB lazily. A STATIC import would pull the Supabase client (and its env
 * requirements) into every module that touches search, including pure-search unit tests that have
 * no database. Resolved per call and never cached here: `karaokeDb()` does its own caching.
 */
async function db(): Promise<{ rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }> } | null> {
  try {
    const mod = await import('./supabase.server');
    return mod.karaokeDb() as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
  } catch {
    return null; // unconfigured (e.g. a unit test) — telemetry is simply absent
  }
}

/**
 * Count one VISIBLE search under its disposition. Zero quota implications: this is the
 * denominator, not the spend. The hour bucket is computed server-side by the RPC so a caller
 * cannot backdate a serve.
 */
export async function recordSearchServe(disposition: SearchServeDisposition): Promise<void> {
  try {
    const client = await db();
    if (!client) return;
    // supabase-js RETURNS `{ error }` for a rejected call rather than throwing, so a bare
    // try/catch alone would report a failed write as a success.
    const { error } = await client.rpc('karaoke_record_youtube_search_serve', {
      p_disposition: disposition,
    });
    if (error) logTelemetryFailure('search_serve');
  } catch {
    logTelemetryFailure('search_serve');
  }
}

/**
 * Record ONE outbound `search.list` request = ONE quota unit.
 *
 * Called only from the branch that actually invoked `fetchItemsFromApi`. The RPC inserts
 * `on conflict (call_id) do nothing`, so a retried WRITE for the same physical call cannot become
 * a second quota row — while a genuinely second outbound request carries a new `callId` and is
 * correctly counted twice.
 */
export async function recordOutboundSearchCall(call: OutboundSearchCall): Promise<void> {
  try {
    const client = await db();
    if (!client) return;
    const { error } = await client.rpc('karaoke_record_youtube_search_call', {
      p_call_id: call.callId,
      p_outcome: call.outcome,
      p_http_status: call.httpStatus ?? null,
      p_upstream_reason: call.upstreamReason ? call.upstreamReason.slice(0, 64) : null,
      p_latency_ms: call.latencyMs ?? null,
      p_style: call.style ?? null,
    });
    if (error) logTelemetryFailure('search_call');
  } catch {
    logTelemetryFailure('search_call');
  }
}
