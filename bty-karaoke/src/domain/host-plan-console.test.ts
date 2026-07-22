// Manager Plan Console V1 — pure vocabulary proofs: provider summarization, privacy
// masking, and anomaly classification. These pin the rules the service/UI reuse.

import { describe, it, expect } from 'vitest';
import {
  providerSummary,
  maskId,
  maskIdempotencyKey,
  changedByRef,
  isUnknownPlanCode,
  detectAnomalies,
  ANOMALY_LABEL,
} from './host-plan-console';

describe('providerSummary', () => {
  it('collapses provider sets into the four presentable states', () => {
    expect(providerSummary(['apple', 'google'])).toBe('apple+google');
    expect(providerSummary(['google', 'apple'])).toBe('apple+google');
    expect(providerSummary(['apple'])).toBe('apple');
    expect(providerSummary(['google'])).toBe('google');
    expect(providerSummary([])).toBe('none');
  });
});

describe('maskId / maskIdempotencyKey / changedByRef', () => {
  it('(21) masks a UUID to head…tail, never the full value', () => {
    const id = '1a0be5e8-90e6-40b3-a26c-7b41be0a9a8c';
    const m = maskId(id);
    expect(m).toBe('1a0be5e8…9a8c');
    expect(m).not.toContain(id);
  });
  it('masks an idempotency key to head…tail', () => {
    const k = 'gate-e-2026-07-22T04-38-42-064Z-ce575b49-2c60-4723-b09c-8a3a57b71883';
    const m = maskIdempotencyKey(k);
    expect(m.startsWith('gate-e-2026-07')).toBe(true);
    expect(m).toContain('…');
    expect(m).not.toBe(k);
  });
  it('changedByRef is "system" for a null actor, masked otherwise', () => {
    expect(changedByRef(null)).toBe('system');
    expect(changedByRef('1a0be5e8-90e6-40b3-a26c-7b41be0a9a8c')).toBe('1a0be5e8…9a8c');
  });
});

describe('isUnknownPlanCode', () => {
  it('flags codes outside the FREE/PRO allowlist', () => {
    expect(isUnknownPlanCode('FREE')).toBe(false);
    expect(isUnknownPlanCode('PRO')).toBe(false);
    expect(isUnknownPlanCode('ENTERPRISE')).toBe(true);
  });
});

describe('detectAnomalies', () => {
  const clean = { accountExists: true, activePlanCodes: ['FREE'], allPlanCodes: ['FREE'], auditLinkIssues: 0 };

  it('an integrity-clean account has NO anomalies', () => {
    expect(detectAnomalies(clean)).toEqual([]);
  });
  it('(23) missing persisted active assignment is flagged', () => {
    expect(detectAnomalies({ ...clean, activePlanCodes: [] })).toContain('no_active_assignment');
  });
  it('(24) duplicate active assignments are flagged', () => {
    expect(detectAnomalies({ ...clean, activePlanCodes: ['FREE', 'PRO'] })).toContain('multiple_active_assignments');
  });
  it('an unknown stored plan code is flagged', () => {
    expect(detectAnomalies({ ...clean, allPlanCodes: ['FREE', 'ENTERPRISE'] })).toContain('unknown_plan_code');
  });
  it('(25) an assignment whose account does not exist is flagged', () => {
    expect(detectAnomalies({ ...clean, accountExists: false })).toContain('assignment_without_account');
  });
  it('an audit referencing a missing assignment is flagged', () => {
    expect(detectAnomalies({ ...clean, auditLinkIssues: 1 })).toContain('audit_unlinked');
  });
  it('every anomaly flag has a human label', () => {
    for (const f of ['no_active_assignment', 'multiple_active_assignments', 'unknown_plan_code', 'assignment_without_account', 'audit_unlinked'] as const) {
      expect(typeof ANOMALY_LABEL[f]).toBe('string');
    }
  });
});
