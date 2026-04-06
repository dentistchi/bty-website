#!/usr/bin/env node
/**
 * bty-website/bty-app is a legacy local stub — not a production or release-gate deploy target.
 * Production: monorepo root bty-app (Supabase cookie auth + Arena). See bty-app/docs/BTY_RELEASE_GATE_CHECK.md
 */
console.error(`
[bty-website/bty-app] This package must not be deployed to production.

Use the canonical app at the monorepo root:
  cd ../../bty-app && npm ci && npm run deploy

Release gate / Arena / auth contract: bty-app/docs/BTY_RELEASE_GATE_CHECK.md
`);
process.exit(1);
