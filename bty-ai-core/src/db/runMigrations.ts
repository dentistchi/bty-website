/**
 * Run database migrations using Node.js (no psql required).
 * Usage: npx ts-node src/db/runMigrations.ts
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { getPool } from "../config/database";

async function runMigrations() {
  const pool = getPool();
  if (!pool) {
    console.log("⚠ DATABASE_URL not set. Skipping migrations.");
    console.log("   Set DATABASE_URL in .env to enable database features.");
    process.exit(0);
  }

  const migrations = [
    "001_organization_emotional_metrics.sql",
    "002_user_sessions.sql",
    "003_maturity_scores.sql",
  ];

  console.log("Running migrations...\n");

  for (const file of migrations) {
    try {
      const path = join(__dirname, "migrations", file);
      const sql = readFileSync(path, "utf-8");
      await pool.query(sql);
      console.log(`✓ ${file}`);
    } catch (err: any) {
      if (err.code === "42P07") {
        // Table already exists
        console.log(`⊘ ${file} (already exists)`);
      } else {
        console.error(`✗ ${file}:`, err.message);
        throw err;
      }
    }
  }

  console.log("\n✅ All migrations completed!");
  await pool.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
