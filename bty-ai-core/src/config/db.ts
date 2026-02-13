/**
 * Unified DB config for bty-app and bots.
 * Reads: DATABASE_URL (Postgres) or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server only).
 *
 * For raw SQL (quality events, migrations): use DATABASE_URL.
 * For Supabase REST API: use SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * When using Supabase-hosted Postgres, set DATABASE_URL to the connection string from
 * Supabase Dashboard > Settings > Database.
 */

import { Pool } from "pg";

let pool: Pool | null = null;

export type DbClient = Pool;

/**
 * Returns a pg Pool for raw SQL (quality events, migrations, etc.).
 * Reads DATABASE_URL first; falls back to SUPABASE_DB_URL if set.
 * Caller should handle null when DB is not configured.
 */
export function getDbClient(): DbClient | null {
  if (pool !== null) return pool;
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) return null;
  pool = new Pool({ connectionString: url });
  return pool;
}

/** @deprecated Use getDbClient() instead. Kept for backward compatibility. */
export function getPool(): DbClient | null {
  return getDbClient();
}
