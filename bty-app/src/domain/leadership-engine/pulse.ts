/**
 * personal_responsibility_pulse — P-A capture aggregation (domain, pure).
 * Source: le_pulse_log (1..5 session/action-loop terminal self-rating).
 * LRI 0.20 term raw source = 14-day rolling mean of pulse_value (1..5).
 * Normalization is computeLRI's job (lri.ts:71) — pulse.ts returns raw mean to
 * avoid double-normalize (seam 3). buildLRIInputs passes pulseMean as raw input.
 * Empty 14d window -> { pulseMean: 0, hasPulse: false } = LRI-pending signal
 * (DESIGN_V1 sections 2/8; mirrors computeAIR empty -> 0 at air.ts:162-164).
 */
const MS_PER_DAY = 86_400_000;
const PULSE_WINDOW_DAYS = 14;

export interface PulseRecord {
  pulse_value: number; // DB CHECK constrains to 1..5
  created_at: Date;
}

export interface Pulse14dResult {
  pulseMean: number; // raw 1..5 mean (0 when empty); computeLRI normalizes once
  hasPulse: boolean; // false -> LRI pending; do NOT collapse to 2-term
}

export function computePulse14d(
  records: PulseRecord[],
  asOf: Date = new Date(),
): Pulse14dResult {
  const asOfMs = asOf.getTime();
  const cutoff = asOfMs - PULSE_WINDOW_DAYS * MS_PER_DAY;
  const inWindow = records.filter((r) => {
    const t = r.created_at.getTime();
    return t >= cutoff && t <= asOfMs;
  });
  if (inWindow.length === 0) {
    return { pulseMean: 0, hasPulse: false };
  }
  const mean =
    inWindow.reduce((sum, r) => sum + r.pulse_value, 0) / inWindow.length;
  return { pulseMean: mean, hasPulse: true };
}
