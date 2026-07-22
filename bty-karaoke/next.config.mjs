import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

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
};

export default nextConfig;
