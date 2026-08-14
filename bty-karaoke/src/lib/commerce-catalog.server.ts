// Operationally active paid catalog (BUILD 26T-R1A). STRICTLY READ ONLY.
//
// WHY THIS EXISTS. BUILD 26T-R0 measured that `karaoke_product_catalog.is_active` is the server's
// operational authorization to ACCEPT a new paid transaction, and that it is consulted at exactly
// one place — after `/verify` has already been handed a signed transaction, which is to say AFTER
// Apple has already charged the customer. A client that could only discover the answer at that
// point would be a client that takes someone's money and then finds out we cannot sell to them.
//
// So this is the pre-purchase read: it tells an authenticated Host which products the BTY server
// is currently willing to accept, BEFORE any purchase begins.
//
// IT RETURNS ONLY ACTIVE PRODUCTS, and does not echo the flag itself. That is deliberate and it is
// the fail-closed shape: a client cannot mistake an inactive row for an active one because an
// inactive row is not there, and a future bug that dropped a boolean cannot accidentally enable a
// sale. With every product inactive this returns an empty list, which is the truthful answer.
//
// IT IS NOT AUTHORIZATION ON ITS OWN. The client must ALSO see the product offered by StoreKit
// (BUILD 26T-R1A dual gate), and `/verify` keeps its own independent `is_active` check unchanged —
// this read is a courtesy to the customer, never a replacement for the gate that protects the
// ledger.
//
// Every field below is already-public commerce contract data (BUILD 18C pricing contract, and the
// durations the app already displays). No financial row, no account data, no `is_active` column
// echo, no price — price belongs to Apple and is read from StoreKit's localized product.

import { karaokeDb } from './supabase.server';

/** One product the BTY server will currently accept a new paid transaction for. */
export interface ActiveCommerceProduct {
  /** The StoreKit product identifier. The client matches on this exact string. */
  productId: string;
  /** The BTY product code (PASS_1H / PASS_4H / PASS_24H). */
  productCode: string;
  /** ONE_HOUR / FOUR_HOURS / TWENTY_FOUR_HOURS. */
  passType: string;
  /** The entitlement this product grants, in seconds — the catalog's contract-pinned duration. */
  durationSeconds: number;
}

const COLS = 'product_code, storekit_product_id, pass_type, duration_seconds';

/**
 * Read the operationally active paid catalog.
 *
 * One select, no write, no RPC. `is_active` is used as a FILTER and never returned: the caller
 * learns what it may sell, not what exists.
 *
 * A row with no StoreKit product id cannot be purchased through Apple, so it is dropped rather
 * than returned as something the client would then fail to match.
 */
export async function readActiveCommerceCatalog(): Promise<ActiveCommerceProduct[]> {
  const { data, error } = await karaokeDb()
    .from('karaoke_product_catalog')
    .select(COLS)
    .eq('is_active', true)
    .order('duration_seconds', { ascending: true });
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[])
    .filter((row) => typeof row.storekit_product_id === 'string' && row.storekit_product_id !== '')
    .map((row) => ({
      productId: String(row.storekit_product_id),
      productCode: String(row.product_code),
      passType: String(row.pass_type),
      durationSeconds: Number(row.duration_seconds),
    }));
}
