#!/usr/bin/env node
/**
 * Build-time env check. Fail fast if NEXT_PUBLIC_SUPABASE_* are missing.
 * Run before next build (e.g. prebuild). Loads .env.local and .env from project root so
 * `npm run deploy` works when those files exist (e.g. locally or in CI with env files).
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvFile(file) {
  if (!existsSync(file)) return false;
  try {
    const content = readFileSync(file, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || trimmed === "") continue;
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1);
        const commentIdx = val.indexOf("#");
        if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();
        if (process.env[m[1]] == null || process.env[m[1]] === "") process.env[m[1]] = val;
      }
    }
    return true;
  } catch (_) {
    return false;
  }
}

const cwd = process.cwd();
const root = resolve(cwd);
const parent = resolve(cwd, "..");
const tried = [];
for (const dir of [root, parent]) {
  for (const name of [".env.local", ".env"]) {
    const file = resolve(dir, name);
    if (loadEnvFile(file)) tried.push(file);
  }
}
if (tried.length > 0) {
  console.log("[check-env] Loaded from:", tried.join(", "));
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || url.trim() === "") {
  console.error("[check-env] NEXT_PUBLIC_SUPABASE_URL is required at build time.");
  console.error("[check-env] Add it to .env.local or .env in this directory (bty-app), or export it.");
  console.error("[check-env] Example: cp .env.example .env.local then edit with your Supabase URL and anon key.");
  process.exit(1);
}
if (!anon || anon.trim() === "") {
  console.error("[check-env] NEXT_PUBLIC_SUPABASE_ANON_KEY is required at build time.");
  console.error("[check-env] Add it to .env.local or .env in bty-app (see .env.example).");
  process.exit(1);
}
console.log("[check-env] NEXT_PUBLIC_SUPABASE_* present.");
