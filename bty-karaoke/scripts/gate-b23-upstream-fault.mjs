// BUILD 23-GATE-R7 — a LOCAL-ONLY upstream fault injector for the isolated G1–G4 authority.
//
// WHY THIS EXISTS. G4 requires the duration resolver to classify a QUOTA failure. Real quota
// exhaustion cannot be produced on demand, and the only way to approach it — hammering the real
// YouTube Data API — would burn the PRODUCTION quota this project depends on. So the fault is
// injected at the process's NETWORK BOUNDARY instead of in the application.
//
// WHAT IT IS NOT:
//   • not a change to any application source file — the Worker code is byte-identical
//   • not a debug bypass inside the production Worker — this file is under scripts/, is never
//     bundled by Next, and is only reachable via `node --import` on a developer machine
//   • not the Native client-side injection — the device talks to a real server that really refuses
//   • not a production mutation — it performs no database access of any kind
//
// It is inert unless GATE_B23_UPSTREAM_FAULT is set, and it intercepts EXACTLY ONE upstream:
// `googleapis.com/youtube/v3/videos`. Every other request — Supabase, assets, everything — goes
// through the real `fetch` untouched.
//
// Usage:
//   GATE_B23_UPSTREAM_FAULT=quota \
//   NODE_OPTIONS='--import ./scripts/gate-b23-upstream-fault.mjs' npx next dev ...

const MODE = process.env.GATE_B23_UPSTREAM_FAULT;

/** The ONE upstream this may ever touch. */
const TARGET = 'googleapis.com/youtube/v3/videos';

/**
 * Response shapes copied from what the real API actually returns, so the resolver's classifier
 * (`isQuotaExhausted` / `upstreamReason` in youtube-duration.server.ts) sees exactly the bytes it
 * would see in production. Nothing here is tailored to the classifier — it is tailored to Google.
 *
 *   quota  — HTTP 403 with errors[0].reason = "quotaExceeded". This is the authentic daily-limit
 *            shape. The resolver must classify it as quota_exceeded and must NOT retry it.
 *   lookup — HTTP 500. A transient server error: the resolver retries ONCE, then lookup_failed.
 */
const FAULTS = {
  quota: {
    status: 403,
    body: {
      error: {
        code: 403,
        message: 'The request cannot be completed because you have exceeded your quota.',
        status: 'RESOURCE_EXHAUSTED',
        errors: [{ reason: 'quotaExceeded', domain: 'youtube.quota', message: 'quotaExceeded' }],
      },
    },
  },
  lookup: {
    status: 500,
    body: { error: { code: 500, message: 'Internal error', status: 'INTERNAL', errors: [{ reason: 'backendError' }] } },
  },
};

if (MODE) {
  const fault = FAULTS[MODE];
  if (!fault) {
    console.error(`[GATE-B23] upstream-fault: unknown mode '${MODE}' — expected one of ${Object.keys(FAULTS).join('|')}. NOT armed.`);
  } else {
    const realFetch = globalThis.fetch;
    let hits = 0;
    globalThis.fetch = async (input, init) => {
      const url =
        typeof input === 'string' ? input
        : input instanceof URL ? input.href
        : (input && typeof input === 'object' && 'url' in input) ? String(input.url)
        : String(input);
      if (!url.includes(TARGET)) return realFetch(input, init);
      hits += 1;
      // Counted and logged so an operator can PROVE how many upstream calls the resolver made —
      // which is what distinguishes "quota is never retried" from "retried once".
      console.warn(`[GATE-B23] upstream-fault applied mode=${MODE} status=${fault.status} upstreamCalls=${hits}`);
      return new Response(JSON.stringify(fault.body), {
        status: fault.status,
        headers: { 'content-type': 'application/json' },
      });
    };
    console.warn(`[GATE-B23] upstream-fault ARMED mode=${MODE} target=${TARGET} (local harness only)`);
  }
} else {
  console.warn('[GATE-B23] upstream-fault=off (real network)');
}
