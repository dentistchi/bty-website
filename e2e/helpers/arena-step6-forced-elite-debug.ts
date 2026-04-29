/**
 * Opt-in debug for forced-elite Arena Step 6 E2E (session router intercept + gate).
 * Enable: `E2E_DEBUG_FORCED_ELITE=1 npx playwright test ...`
 */

export function isE2eForcedEliteDebug(): boolean {
  return process.env.E2E_DEBUG_FORCED_ELITE === "1" || process.env.E2E_DEBUG_FORCED_ELITE === "true";
}

const MAX_JSON_LOG = 6_000;

export function truncateForE2eLog(value: string, max = MAX_JSON_LOG): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…[truncated ${value.length - max} chars]`;
}

export function logE2eForcedElite(phase: string, data: Record<string, unknown>): void {
  if (!isE2eForcedEliteDebug()) return;
  const payload = { phase, ts: new Date().toISOString(), ...data };
  console.log(`[e2e-forced-elite] ${JSON.stringify(payload)}`);
}

type SessionBodyShape = {
  ok?: boolean;
  error?: string;
  scenario?: { scenarioId?: string; eliteSetup?: unknown };
};

export function summarizeSessionBodyForLog(body: SessionBodyShape): Record<string, unknown> {
  const sc = body.scenario;
  return {
    ok: body.ok,
    error: body.error,
    scenarioId: sc?.scenarioId,
    hasEliteSetup: Boolean(sc?.eliteSetup),
    eliteSetupType: sc?.eliteSetup == null ? "nullish" : typeof sc.eliteSetup,
  };
}

type GateLogInput =
  | {
      proceed: true;
      sessionBody: SessionBodyShape;
      response: { status: () => number };
    }
  | { proceed: false; reason: string; detail?: string };

export function summarizeStep6GateForLog(gate: GateLogInput): Record<string, unknown> {
  if (gate.proceed) {
    return {
      proceed: true,
      ...summarizeSessionBodyForLog(gate.sessionBody),
      responseStatus: gate.response.status(),
    };
  }
  return { proceed: false, reason: gate.reason, detail: gate.detail };
}
