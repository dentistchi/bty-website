// Copy the pdf.js worker from the installed pdfjs-dist into public/ so the
// Foundry PDF Study Room viewer can load a SELF-HOSTED worker (no external CDN,
// CSP-safe) whose version always matches the installed pdfjs-dist. Runs in
// prebuild; idempotent.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const destDir = resolve(root, "public");
const dest = resolve(destDir, "pdf.worker.min.mjs");

if (!existsSync(src)) {
  console.warn(`[copy-pdf-worker] source not found: ${src} (pdfjs-dist not installed?) — skipping`);
  process.exit(0);
}
if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] copied pdf.worker.min.mjs -> public/`);
