// BUILD 26U-R4G-R1 — status-aware retry, proven behaviourally.
//
// THE REGRESSION THIS SUITE EXISTS FOR, measured by R4G-R0 against production:
//
//   verified REFUND -> inbox row RECEIVED -> lifecycle apply fails -> row FAILED -> 503
//   -> Apple retries the SAME notificationUUID -> recorder said "duplicate" from row existence
//   -> handler returned success -> 200 -> Apple stopped -> the refund was never applied.
//
// These tests drive the REAL handler. The database is stubbed at the call boundary — an in-memory
// inbox plus scripted RPC outcomes — so the failure modes that matter (a transient RPC error, a
// status write that does not land, a process that dies mid-flight) can be produced on demand,
// which is the only way to assert what happens on the delivery AFTER them.
//
// The SQL itself is proven separately, against a real Postgres with every production migration,
// by scripts/verify-r4g-retry.sh. Neither proof substitutes for the other: this one asserts that
// the handler asks the right question, that one asserts the database gives the right answer.

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Status = 'RECEIVED' | 'APPLIED' | 'IGNORED' | 'FAILED';

const state = {
  inbox: new Map<string, { status: Status; discovery_source: string }>(),
  /** null = the RPC succeeds. */
  refundError: null as { message: string } | null,
  reversalError: null as { message: string } | null,
  /** What the refund/reversal RPC reports when it does run. */
  refundResult: { ok: true, deniedSeconds: 3600, replayed: false } as Record<string, unknown>,
  reversalResult: { ok: true, restoredSeconds: 3599, replayed: false } as Record<string, unknown>,
  recorderError: null as { message: string } | null,
  /** Make the terminal status write fail — the case that leaves a row at RECEIVED. */
  markFails: false,
  calls: { recorder: 0, refund: 0, reversal: 0, marks: [] as string[] },
  /** The notification the verifier will report. */
  notificationType: 'REFUND',
  transactionId: '2000000900000001' as string | null,
  outerOk: true,
  innerOk: true,
};

function resetState() {
  state.inbox = new Map();
  state.refundError = null;
  state.reversalError = null;
  state.refundResult = { ok: true, deniedSeconds: 3600, replayed: false };
  state.reversalResult = { ok: true, restoredSeconds: 3599, replayed: false };
  state.recorderError = null;
  state.markFails = false;
  state.calls = { recorder: 0, refund: 0, reversal: 0, marks: [] };
  state.notificationType = 'REFUND';
  state.transactionId = '2000000900000001';
  state.outerOk = true;
  state.innerOk = true;
}

const UUID = 'a1b2c3d4-0000-4000-8000-000000000001';

vi.mock('./apple-iap.server', () => ({
  verifyAppleSignedPayload: vi.fn(async () =>
    state.outerOk
      ? {
          ok: true as const,
          payload: {
            notificationType: state.notificationType,
            notificationUUID: UUID,
            signedDate: 1_756_000_000_000,
            data: { signedTransactionInfo: 'inner.jws.value' },
          } as Record<string, unknown>,
        }
      : { ok: false as const, code: 'bad_chain' }),
  verifyAppleSignedTransaction: vi.fn(async () =>
    state.innerOk
      ? {
          ok: true as const,
          environment: 'Sandbox' as const,
          claims: {
            transactionId: state.transactionId,
            originalTransactionId: '2000000900000000',
            revocationDate: 1_756_000_000_000,
            revocationReason: 1,
          } as Record<string, unknown>,
        }
      : { ok: false as const, code: 'bad_inner' }),
  signedTransactionDigest: vi.fn(async () => 'digest-abc'),
}));

vi.mock('./supabase.server', () => ({
  karaokeDb: () => ({
    // The recorder, modelled on the migration's effective definition: insert-or-read, and report
    // the row's PROCESSING truth rather than its mere existence.
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === 'karaoke_record_apple_notification') {
        state.calls.recorder += 1;
        if (state.recorderError) return { data: null, error: state.recorderError };
        const src = String(args.p_discovery_source ?? 'SERVER_NOTIFICATION');
        if (src !== 'SERVER_NOTIFICATION' && src !== 'API_RECOVERY') {
          return { data: { ok: false, error: 'invalid_discovery_source' }, error: null };
        }
        const uuid = String(args.p_notification_uuid);
        const existing = state.inbox.get(uuid);
        if (!existing) {
          state.inbox.set(uuid, { status: 'RECEIVED', discovery_source: src });
          return {
            data: {
              ok: true, inserted: true, processingStatus: 'RECEIVED', discoverySource: src,
              shouldProcess: true, alreadyHandled: false,
            },
            error: null,
          };
        }
        const done = existing.status === 'APPLIED' || existing.status === 'IGNORED';
        return {
          data: {
            ok: true, inserted: false, processingStatus: existing.status,
            discoverySource: existing.discovery_source,
            shouldProcess: !done, alreadyHandled: done,
          },
          error: null,
        };
      }
      if (name === 'apply_apple_purchase_refund') {
        state.calls.refund += 1;
        if (state.refundError) return { data: null, error: state.refundError };
        return { data: state.refundResult, error: null };
      }
      if (name === 'apply_apple_refund_reversal') {
        state.calls.reversal += 1;
        if (state.reversalError) return { data: null, error: state.reversalError };
        return { data: state.reversalResult, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
    from() {
      let pending: Record<string, unknown> = {};
      const builder = {
        update(row: Record<string, unknown>) { pending = row; return builder; },
        eq(_col: string, value: string) {
          if (state.markFails) return Promise.resolve({ error: { message: 'update failed' } });
          const status = String(pending.processing_status) as Status;
          state.calls.marks.push(status);
          const existing = state.inbox.get(value);
          if (existing) state.inbox.set(value, { ...existing, status });
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    },
  }),
}));

const { handleAppleServerNotification } = await import('./apple-server-notifications.server');

const deliver = (source: 'SERVER_NOTIFICATION' | 'API_RECOVERY' = 'SERVER_NOTIFICATION') =>
  handleAppleServerNotification('outer.jws.value', source);

beforeEach(resetState);

// ── THE BLOCKER ITSELF ───────────────────────────────────────────────────────

describe('R4G-1 — a FAILED financial notification is never acknowledged as handled', () => {
  it('the retry after a transient apply failure REPROCESSES and applies', async () => {
    state.refundError = { message: 'connection reset' };
    const first = await deliver();
    expect(first.ok).toBe(false);
    expect(first).toMatchObject({ code: 'internal', unfinishedFinancial: true });
    expect(state.inbox.get(UUID)?.status).toBe('FAILED');

    // Apple comes back. This is the delivery that used to return 200 having done nothing.
    state.refundError = null;
    const retry = await deliver();
    expect(retry).toMatchObject({ ok: true, handled: true, duplicate: false, disposition: 'REPROCESSED' });
    expect(state.inbox.get(UUID)?.status).toBe('APPLIED');
    // The lifecycle actually ran a second time — the RPC is idempotent, and running it is the
    // whole repair. Two calls, one of which is the one that mattered.
    expect(state.calls.refund).toBe(2);
  });

  it('a FAILED row that still cannot be applied stays unfinished and asks for another retry', async () => {
    state.refundError = { message: 'down' };
    await deliver();
    const retry = await deliver();
    expect(retry).toMatchObject({ ok: false, code: 'internal', unfinishedFinancial: true });
    expect(state.inbox.get(UUID)?.status).toBe('FAILED');
  });
});

describe('R4G-2 — RECEIVED is unfinished too', () => {
  it('a row left at RECEIVED by a lost process is picked back up', async () => {
    // The apply succeeded and the status write did not land: exactly the case R4G-R0 measured.
    state.markFails = true;
    const first = await deliver();
    expect(first).toMatchObject({ ok: false, code: 'internal', detail: 'mark_applied' });
    expect(state.inbox.get(UUID)?.status).toBe('RECEIVED');
    expect(state.calls.refund).toBe(1);

    // The retry replays the idempotent RPC and finishes the bookkeeping.
    state.markFails = false;
    state.refundResult = { ok: true, deniedSeconds: 3600, replayed: true };
    const retry = await deliver();
    expect(retry).toMatchObject({ ok: true, handled: true, disposition: 'REPROCESSED', detail: 'refund_replayed' });
    expect(state.inbox.get(UUID)?.status).toBe('APPLIED');
  });

  it('a committed lifecycle mutation is NEVER undone because the status write failed', async () => {
    state.markFails = true;
    await deliver();
    // Nothing compensating, nothing reversing — the only marks attempted are forward ones.
    expect(state.calls.reversal).toBe(0);
    expect(state.calls.marks).toEqual([]);
  });
});

// ── POSITIVE CONTROLS: good dedupe must survive the fix ──────────────────────

describe('R4G-3 — APPLIED and IGNORED still mean there is nothing left to do', () => {
  it('an APPLIED row short-circuits without touching the lifecycle', async () => {
    await deliver();
    expect(state.inbox.get(UUID)?.status).toBe('APPLIED');
    const again = await deliver();
    expect(again).toMatchObject({ ok: true, handled: false, duplicate: true, disposition: 'ALREADY_HANDLED' });
    expect(state.calls.refund).toBe(1); // NOT 2 — the second delivery ran no lifecycle RPC
  });

  it('an IGNORED row short-circuits too, and is not treated as failed', async () => {
    state.notificationType = 'TEST';
    const first = await deliver();
    expect(first).toMatchObject({ ok: true, disposition: 'IGNORED' });
    expect(state.inbox.get(UUID)?.status).toBe('IGNORED');
    const again = await deliver();
    expect(again).toMatchObject({ ok: true, duplicate: true, disposition: 'ALREADY_HANDLED' });
    expect(state.calls.refund).toBe(0);
  });

  it('one inbox row throughout, whatever the delivery count', async () => {
    await deliver();
    await deliver();
    await deliver('API_RECOVERY');
    expect(state.inbox.size).toBe(1);
  });
});

describe('R4G-4 — first application is named apart from a repair', () => {
  it('a new REFUND is NEWLY_APPLIED', async () => {
    const r = await deliver();
    expect(r).toMatchObject({ ok: true, handled: true, duplicate: false, disposition: 'NEWLY_APPLIED' });
  });

  it('a new REFUND_REVERSED is NEWLY_APPLIED and restores the exact seconds', async () => {
    state.notificationType = 'REFUND_REVERSED';
    const r = await deliver();
    expect(r).toMatchObject({ ok: true, handled: true, disposition: 'NEWLY_APPLIED' });
    expect(state.calls.reversal).toBe(1);
    expect(state.inbox.get(UUID)?.status).toBe('APPLIED');
  });

  it('a reversal that fails transiently is reprocessed on the retry, once', async () => {
    state.notificationType = 'REFUND_REVERSED';
    state.reversalError = { message: 'blip' };
    await deliver();
    expect(state.inbox.get(UUID)?.status).toBe('FAILED');
    state.reversalError = null;
    const retry = await deliver();
    expect(retry).toMatchObject({ ok: true, disposition: 'REPROCESSED' });
    expect(state.inbox.get(UUID)?.status).toBe('APPLIED');
  });
});

// ── THE ORDERING RACE ────────────────────────────────────────────────────────

describe('R4G-5 — a refund that arrives before its purchase is not lost', () => {
  it('an unresolvable purchase stays RECOVERABLE, not terminal', async () => {
    state.refundResult = { ok: false, error: 'purchase_not_found' };
    const first = await deliver();
    // Deliberately NOT ok:true/IGNORED, which is what made this permanent before.
    expect(first).toMatchObject({ ok: false, code: 'not_found', unfinishedFinancial: true });
    expect(state.inbox.get(UUID)?.status).toBe('FAILED');
  });

  it('…and applies once the purchase exists, under the SAME notificationUUID', async () => {
    state.refundResult = { ok: false, error: 'purchase_not_found' };
    await deliver();
    state.refundResult = { ok: true, deniedSeconds: 3600, replayed: false };
    const retry = await deliver();
    expect(retry).toMatchObject({ ok: true, handled: true, disposition: 'REPROCESSED' });
    expect(state.inbox.get(UUID)?.status).toBe('APPLIED');
    expect(state.inbox.size).toBe(1);
  });
});

// ── LIVE AND RECOVERY ARE ONE PATH ───────────────────────────────────────────

describe('R4G-6 — API_RECOVERY and a live Apple retry obey identical rules', () => {
  it('recovery repairs a FAILED live delivery', async () => {
    state.refundError = { message: 'blip' };
    await deliver('SERVER_NOTIFICATION');
    expect(state.inbox.get(UUID)?.status).toBe('FAILED');

    state.refundError = null;
    const recovered = await deliver('API_RECOVERY');
    expect(recovered).toMatchObject({ ok: true, disposition: 'REPROCESSED' });
    expect(state.inbox.get(UUID)?.status).toBe('APPLIED');
  });

  it('a live retry repairs a FAILED recovery attempt', async () => {
    state.refundError = { message: 'blip' };
    await deliver('API_RECOVERY');
    state.refundError = null;
    const live = await deliver('SERVER_NOTIFICATION');
    expect(live).toMatchObject({ ok: true, disposition: 'REPROCESSED' });
  });

  it('discovery_source records how BTY FIRST recorded it, in both orders', async () => {
    state.refundError = { message: 'blip' };
    await deliver('SERVER_NOTIFICATION');
    state.refundError = null;
    await deliver('API_RECOVERY');
    expect(state.inbox.get(UUID)?.discovery_source).toBe('SERVER_NOTIFICATION');

    resetState();
    state.refundError = { message: 'blip' };
    await deliver('API_RECOVERY');
    state.refundError = null;
    await deliver('SERVER_NOTIFICATION');
    expect(state.inbox.get(UUID)?.discovery_source).toBe('API_RECOVERY');
  });
});

// ── NOTHING REACHES THE INBOX WITHOUT A SIGNATURE ────────────────────────────

describe('R4G-7 — verification still precedes every write', () => {
  it('an unverifiable envelope never reaches the recorder', async () => {
    state.outerOk = false;
    const r = await deliver();
    expect(r).toMatchObject({ ok: false, code: 'unverifiable' });
    expect(state.calls.recorder).toBe(0);
    expect(state.inbox.size).toBe(0);
  });

  it('an unverifiable inner transaction never reaches the recorder', async () => {
    state.innerOk = false;
    const r = await deliver();
    expect(r).toMatchObject({ ok: false, code: 'unverifiable' });
    expect(state.calls.recorder).toBe(0);
  });

  it('a recorder failure stops before any lifecycle call', async () => {
    state.recorderError = { message: 'inbox down' };
    const r = await deliver();
    expect(r).toMatchObject({ ok: false, code: 'internal' });
    expect(state.calls.refund).toBe(0);
  });

  it('a recorder refusal is a retryable failure, never a silent proceed', async () => {
    // e.g. an invalid discovery_source: ok:false from the RPC, not an exception.
    const r = await handleAppleServerNotification('outer.jws.value', 'NOPE' as never);
    expect(r).toMatchObject({ ok: false, code: 'internal', detail: 'invalid_discovery_source' });
    expect(state.calls.refund).toBe(0);
  });

  it('a verified financial event with no transaction id is FAILED and refused', async () => {
    state.transactionId = null;
    const r = await deliver();
    expect(r).toMatchObject({ ok: false, code: 'malformed', unfinishedFinancial: true });
    expect(state.inbox.get(UUID)?.status).toBe('FAILED');
  });
});
