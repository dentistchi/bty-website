/**
 * Playwright sets `window.__BTY_E2E_TRACE_STEP6 = true` before contract submit so Step 6→7
 * instrumentation runs without `NEXT_PUBLIC_*` rebuild. No effect in production when unset.
 */
export function isBtyE2eStep6TraceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean((window as unknown as { __BTY_E2E_TRACE_STEP6?: boolean }).__BTY_E2E_TRACE_STEP6);
  } catch {
    return false;
  }
}
