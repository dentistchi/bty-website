import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { execSync } from 'node:child_process';

// BUILD 20B-WEB7-R4 — a DETERMINISTIC, per-commit build id. It names the immutable
// asset folder AND is exposed to client + server as NEXT_PUBLIC_KARAOKE_BUILD so the
// guest document can prove which build a client is actually running (freshness guard).
// Git short SHA when available (local / CI checkout); a stable fallback otherwise.
function karaokeBuildId() {
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'nogit';
  }
}

const BUILD_ID = karaokeBuildId();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the file-tracing root to this app; the monorepo has sibling lockfiles.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  // Room Branding V1: keep @cf-wasm/photon OUT of webpack so its native
  // `import … from "*.wasm"` reaches wrangler/workerd, which precompiles the module
  // at deploy time. Without this, webpack inlines the wasm as bytes and photon calls
  // `new WebAssembly.Module(bytes)` at runtime → workerd rejects it with
  // "Wasm code generation disallowed by embedder". Must NOT be in transpilePackages.
  serverExternalPackages: ['@cf-wasm/photon'],
  // Deterministic build id so a stale client can be detected against the live one.
  generateBuildId: () => BUILD_ID,
  env: {
    NEXT_PUBLIC_KARAOKE_BUILD: BUILD_ID,
  },
};

export default nextConfig;
