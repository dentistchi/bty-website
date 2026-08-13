// POST /api/manager/timed-passes/issue — operator-gated pass issuance (BUILD 17 §4/Gate A).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// BUILD 26O — the provenance the real helper derives from the session cookie. The route must use
// THIS, whatever the request body says.
const SESSION_ISSUANCE = {
  version: 1,
  source: 'manager_issue',
  actor_kind: 'shared_manager_credential' as const,
  actor_id: 'bty_mgr',
  session_fp: 'aaaaaaaaaaaaaaaa',
};

const state = { enabled: true, ok: false, issuance: SESSION_ISSUANCE as typeof SESSION_ISSUANCE | null };
const managerIssuanceActor = vi.fn(async (_req: unknown, source: string) =>
  state.issuance ? { ...state.issuance, source } : null,
);
vi.mock('@/lib/manager-auth.server', () => ({
  managerEnabled: () => state.enabled,
  managerAuthorized: vi.fn(async () => state.ok),
  managerIssuanceActor: (...a: [unknown, string]) => managerIssuanceActor(...a),
}));
const issueTimedPass = vi.fn();
vi.mock('@/lib/timed-pass.server', () => ({ issueTimedPass: (...a: unknown[]) => issueTimedPass(...a) }));

import { POST } from './route';

function req(body: unknown) {
  return new Request('https://x/api/manager/timed-passes/issue', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  state.enabled = true;
  state.ok = false;
  state.issuance = SESSION_ISSUANCE;
  issueTimedPass.mockReset();
  managerIssuanceActor.mockClear();
});

describe('POST /api/manager/timed-passes/issue', () => {
  it('unauthenticated / plain Host → 401, never issues', async () => {
    const res = await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', idempotencyKey: 'k' }));
    expect(res.status).toBe(401);
    expect(issueTimedPass).not.toHaveBeenCalled();
  });

  it('503 when manager is not enabled', async () => {
    state.enabled = false;
    state.ok = true;
    const res = await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', idempotencyKey: 'k' }));
    expect(res.status).toBe(503);
  });

  it('rejects an arbitrary pass type (closed enum) before the service', async () => {
    state.ok = true;
    const res = await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'TWO_HOURS', idempotencyKey: 'k' }));
    expect(res.status).toBe(400);
    expect(issueTimedPass).not.toHaveBeenCalled();
  });

  it('Gate A: authorized operator issues a 1h pass on a FREE account', async () => {
    state.ok = true;
    issueTimedPass.mockResolvedValue({ ok: true, passGrantId: 'g1', passType: 'ONE_HOUR', status: 'AVAILABLE', reused: false });
    const res = await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', reason: 'gate A', idempotencyKey: 'k1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, passGrantId: 'g1', passType: 'ONE_HOUR', status: 'AVAILABLE' });
    expect(issueTimedPass).toHaveBeenCalledWith({
      accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', reason: 'gate A', idempotencyKey: 'k1',
      issuance: SESSION_ISSUANCE,
    });
  });

  it('§6: a PRO account is blocked with 409 account_is_pro', async () => {
    state.ok = true;
    issueTimedPass.mockResolvedValue({ ok: false, error: 'account_is_pro' });
    const res = await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', idempotencyKey: 'k' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('account_is_pro');
  });

  // ── BUILD 26O — actor attribution is SERVER-DERIVED ──────────────────────────────────
  //
  // The defect these protect against is not "the wrong name is displayed"; it is an audit trail
  // that a caller can author. If a request body could steer attribution, the forensic record
  // becomes a record of what someone typed.

  it('26O: attribution is derived from the session, not the body', async () => {
    state.ok = true;
    issueTimedPass.mockResolvedValue({ ok: true, passGrantId: 'g1', passType: 'ONE_HOUR', status: 'AVAILABLE', reused: false });
    await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', idempotencyKey: 'k1' }));
    expect(managerIssuanceActor).toHaveBeenCalledTimes(1);
    expect(managerIssuanceActor.mock.calls[0][1]).toBe('manager_issue');
    expect(issueTimedPass.mock.calls[0][0].issuance).toEqual(SESSION_ISSUANCE);
  });

  it('26O: a forged issuer in the body cannot control the stored actor', async () => {
    state.ok = true;
    issueTimedPass.mockResolvedValue({ ok: true, passGrantId: 'g1', passType: 'ONE_HOUR', status: 'AVAILABLE', reused: false });
    const res = await POST(req({
      accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', idempotencyKey: 'k1',
      issued_by: 'founder', issuer: 'Dr. Chi', actor_id: 'victim-account',
      actor_kind: 'authenticated_human', manager_name: 'someone else', email: 'a@b.c',
    }));
    expect(res.status).toBe(200);
    const sent = issueTimedPass.mock.calls[0][0];
    expect(sent.issuance).toEqual(SESSION_ISSUANCE);
    expect(sent.issuance.actor_id).toBe('bty_mgr');
    expect(sent.issuance.actor_kind).toBe('shared_manager_credential');
    // The forged keys reach neither the provenance nor the service call at all.
    for (const k of ['issued_by', 'issuer', 'manager_name', 'email', 'actor_id', 'actor_kind']) {
      expect(sent).not.toHaveProperty(k);
      expect(JSON.stringify(sent.issuance)).not.toContain('founder');
      expect(JSON.stringify(sent.issuance)).not.toContain('victim-account');
    }
  });

  it('26O: a forged accountId-shaped actor cannot redirect attribution', async () => {
    state.ok = true;
    issueTimedPass.mockResolvedValue({ ok: true, passGrantId: 'g1', passType: 'ONE_HOUR', status: 'AVAILABLE', reused: false });
    await POST(req({
      accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', idempotencyKey: 'k1',
      issuance: { version: 9, source: 'forged', actor_kind: 'authenticated_human', actor_id: '22222222-2222-2222-2222-222222222222', session_fp: 'deadbeefdeadbeef' },
    }));
    expect(issueTimedPass.mock.calls[0][0].issuance).toEqual(SESSION_ISSUANCE);
  });

  it('26O: authorized but no derivable provenance → 401 and NO issuance', async () => {
    state.ok = true;
    state.issuance = null;
    const res = await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', idempotencyKey: 'k' }));
    expect(res.status).toBe(401);
    // The point of the gate: refuse rather than create a grant nobody can explain later.
    expect(issueTimedPass).not.toHaveBeenCalled();
  });

  it('26O-R1: an idempotency conflict is a 409 and discloses nothing about the other grant', async () => {
    state.ok = true;
    issueTimedPass.mockResolvedValue({ ok: false, error: 'idempotency_conflict' });
    const res = await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', idempotencyKey: 'shared' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: 'idempotency_conflict' });
    // Naming the grant that owns the key would disclose another account's entitlement to
    // whoever guessed the key.
    expect(body).not.toHaveProperty('passGrantId');
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('passType');
    expect(body).not.toHaveProperty('accountId');
  });

  it('26O: an unattributed RPC refusal is a 500, not a client error, and issues nothing', async () => {
    state.ok = true;
    issueTimedPass.mockResolvedValue({ ok: false, error: 'issuance_provenance_required' });
    const res = await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', idempotencyKey: 'k' }));
    expect(res.status).toBe(500);
  });

  it('26O: provenance is derived only AFTER authorization', async () => {
    state.ok = false;
    await POST(req({ accountId: '11111111-1111-1111-1111-111111111111', passType: 'ONE_HOUR', idempotencyKey: 'k' }));
    expect(managerIssuanceActor).not.toHaveBeenCalled();
  });
});
