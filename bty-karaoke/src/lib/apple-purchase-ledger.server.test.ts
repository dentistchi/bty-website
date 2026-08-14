// The Apple purchase ledger writer — BUILD 26T-R1A-R1.
//
// BUILD 26P's route tests mocked this module out, so the one thing R1A-R1 depends on had never
// been asserted anywhere: that the id a first write reports and the id a replay reports are the
// SAME durable row. `/verify` now hands that id to the client, and `/fulfil` settles against it,
// so "the replay converges to the original row" stopped being an implementation detail and became
// the contract.
//
// The database is stubbed at the query-builder boundary rather than mocked per-call, so the tests
// exercise the real insert → 23505 → read-the-winner → classify path in this module.

import { describe, it, expect, vi, beforeEach } from 'vitest';

/** One durable row, as PostgREST would return it. */
const ROW_ID = '28ab7288-ed3b-43b6-acef-484d1f635032';
const OWNER = '11111111-2222-4333-8444-555555555555';

const state = {
  /** null => the insert succeeds; set to make the unique index fire. */
  insertError: null as { code: string } | null,
  /** What the post-conflict read finds. */
  existing: null as Record<string, unknown> | null,
  inserts: 0,
  selects: 0,
  insertedRows: [] as Record<string, unknown>[],
};

function durableRow(over: Record<string, unknown> = {}) {
  return {
    id: ROW_ID,
    account_id: 'acct-1',
    product_code: 'PASS_1H',
    apple_transaction_id: '2000000900000001',
    environment: 'Sandbox',
    verification_status: 'VERIFIED',
    grant_status: 'NOT_GRANTED',
    pass_grant_id: null,
    ...over,
  };
}

/** A minimal PostgREST-shaped builder: `.insert().select().maybeSingle()` and `.select().eq().eq().maybeSingle()`. */
function fakeDb() {
  return {
    from() {
      const builder: Record<string, unknown> = {};
      let mode: 'insert' | 'select' = 'select';
      Object.assign(builder, {
        insert(row: Record<string, unknown>) {
          mode = 'insert';
          state.inserts += 1;
          state.insertedRows.push(row);
          return builder;
        },
        select() {
          if (mode !== 'insert') state.selects += 1;
          return builder;
        },
        eq() { return builder; },
        async maybeSingle() {
          if (mode === 'insert') {
            return state.insertError
              ? { data: null, error: state.insertError }
              : { data: durableRow(), error: null };
          }
          return { data: state.existing, error: null };
        },
      });
      return builder;
    },
  };
}

vi.mock('./supabase.server', () => ({ karaokeDb: () => fakeDb() }));

import { recordVerifiedApplePurchase } from './apple-purchase-ledger.server';

const TRANSACTION = {
  transactionId: '2000000900000001',
  originalTransactionId: '2000000900000001',
  productId: 'com.btydaily.norebang.pass.1hour',
  environment: 'Sandbox' as const,
  purchaseDate: '2026-08-14T05:31:33.000Z',
  quantity: 1,
  revoked: false,
  revocationDate: null,
  revocationReason: null,
};

function args(over: Record<string, unknown> = {}) {
  return {
    accountId: 'acct-1',
    purchaseOwnerRef: OWNER,
    transaction: TRANSACTION as never,
    productCode: 'PASS_1H',
    signedTransaction: 'aaa.bbb.ccc',
    signedTransactionSha256: 'd'.repeat(64),
    ...over,
  };
}

beforeEach(() => {
  state.insertError = null;
  state.existing = null;
  state.inserts = 0;
  state.selects = 0;
  state.insertedRows = [];
});

describe('the id a successful write reports', () => {
  it('is the durable row id, and the write happens once', async () => {
    const outcome = await recordVerifiedApplePurchase(args());
    expect(outcome).toMatchObject({ ok: true, purchaseId: ROW_ID, productCode: 'PASS_1H', replayed: false });
    expect(state.inserts).toBe(1);
  });

  it('records NOT_GRANTED with no grant linkage — recording is not granting', async () => {
    await recordVerifiedApplePurchase(args());
    expect(state.insertedRows[0]).toMatchObject({
      grant_status: 'NOT_GRANTED', granted_seconds: null, pass_grant_id: null,
      verification_status: 'VERIFIED',
    });
  });
});

describe('a replay converges to the original row', () => {
  it('returns the SAME id the first write returned, flagged as a replay', async () => {
    const first = await recordVerifiedApplePurchase(args());

    // The second delivery loses the race with the unique index and reads the durable winner.
    state.insertError = { code: '23505' };
    state.existing = durableRow();
    const second = await recordVerifiedApplePurchase(args());

    expect(second).toMatchObject({ ok: true, replayed: true });
    expect((second as { purchaseId: string }).purchaseId)
      .toBe((first as { purchaseId: string }).purchaseId);
  });

  it('creates NO second row merely to produce an id', async () => {
    state.insertError = { code: '23505' };
    state.existing = durableRow();
    state.inserts = 0;
    const outcome = await recordVerifiedApplePurchase(args());
    expect(outcome).toMatchObject({ ok: true, purchaseId: ROW_ID, replayed: true });
    // Exactly one insert was ATTEMPTED and it failed; the id came from reading the winner.
    expect(state.inserts).toBe(1);
    expect(state.selects).toBe(1);
  });

  it('an arbitrary number of replays all name the same row', async () => {
    state.insertError = { code: '23505' };
    state.existing = durableRow();
    const ids = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const outcome = await recordVerifiedApplePurchase(args());
      ids.add((outcome as { purchaseId: string }).purchaseId);
    }
    expect([...ids]).toEqual([ROW_ID]);
  });
});

describe('a conflict that is not this account\'s replay yields no id at all', () => {
  it('another account owns the transaction -> refused, and nothing is disclosed', async () => {
    state.insertError = { code: '23505' };
    state.existing = durableRow({ account_id: 'acct-2' });
    const outcome = await recordVerifiedApplePurchase(args());
    expect(outcome).toEqual({ ok: false, code: 'transaction_already_claimed' });
    expect(JSON.stringify(outcome)).not.toContain(ROW_ID);
    expect(JSON.stringify(outcome)).not.toContain('acct-2');
  });

  it('the stored product contradicts the verified one -> refused, never reconciled', async () => {
    state.insertError = { code: '23505' };
    state.existing = durableRow({ product_code: 'PASS_24H' });
    const outcome = await recordVerifiedApplePurchase(args());
    expect(outcome).toEqual({ ok: false, code: 'ledger_invariant_conflict' });
    expect(JSON.stringify(outcome)).not.toContain(ROW_ID);
  });

  it('a non-unique-violation error is thrown, not turned into an outcome', async () => {
    state.insertError = { code: '42703' };
    await expect(recordVerifiedApplePurchase(args())).rejects.toMatchObject({ code: '42703' });
  });
});
