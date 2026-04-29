/**
 * Apply `20260430340000_memory_engine_user_behavior_events_align.sql` to Postgres.
 *
 * Requires a direct/pooler URI with password (Supabase Dashboard → Settings → Database → URI).
 * Service role key cannot run DDL.
 *
 *   cd bty-app && DATABASE_URL='postgresql://postgres.[ref]:[PASSWORD]@...' npx tsx scripts/apply-memory-engine-align.ts
 *
 * Or use Session mode / pooler port 5432 or 6543 per Supabase docs.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error(
      "Set DATABASE_URL to your Supabase Postgres URI (include password). Dashboard → Project Settings → Database → Connection string → URI.",
    );
    process.exit(1);
  }

  const sqlPath = resolve(__dirname, "../supabase/migrations/20260430340000_memory_engine_user_behavior_events_align.sql");
  const sql = readFileSync(sqlPath, "utf8");

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log("OK: applied", sqlPath);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
