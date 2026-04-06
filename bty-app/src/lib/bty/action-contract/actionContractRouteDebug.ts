/**
 * Opt-in diagnostics for POST /api/action-contracts (hosted Supabase triage).
 * Set `BTY_ACTION_CONTRACT_ROUTE_DEBUG=1` on the app server to include a `debug` object in JSON error responses.
 * Do not enable on untrusted public deployments (exposes Supabase error messages).
 */
export function isActionContractRouteDebugEnabled(): boolean {
  const v = process.env.BTY_ACTION_CONTRACT_ROUTE_DEBUG?.trim().toLowerCase();
  return v === "1" || v === "true";
}

/** Project ref from `NEXT_PUBLIC_SUPABASE_URL` host `https://<ref>.supabase.co` — for log correlation only. */
export function supabaseProjectRefFromEnvForLogs(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname;
    const m = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
    return m ? m[1] : host;
  } catch {
    return null;
  }
}
