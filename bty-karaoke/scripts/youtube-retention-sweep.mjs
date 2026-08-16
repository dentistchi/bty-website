#!/usr/bin/env npx tsx
// BUILD 26T-R1B-R6-R1B-R5 — operator-invoked YouTube retention sweep.
//
// SERVER ONLY, BY CONSTRUCTION. There is no API route for this. The sweep exists solely as a
// process an operator runs with the service-role key in the environment, so there is no
// client-reachable surface to secure and no arbitrary sweep a caller could trigger.
//
// DRY RUN IS THE DEFAULT. A live pass requires `--live` explicitly. The report prints COUNTS
// only — never a title, video id, guest name or account id.
//
//   npx tsx scripts/youtube-retention-sweep.mjs                 # dry run
//   npx tsx scripts/youtube-retention-sweep.mjs --limit 50      # dry run, smaller batch
//   npx tsx scripts/youtube-retention-sweep.mjs --live          # PERSISTS

import { runRetentionSweep } from '../src/lib/youtube-retention.server.ts';

const args = process.argv.slice(2);
const live = args.includes('--live');
const limitArg = args.indexOf('--limit');
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 200;

if (!Number.isFinite(limit) || limit <= 0 || limit > 1000) {
  console.error('--limit must be between 1 and 1000');
  process.exit(2);
}

const report = await runRetentionSweep({ dryRun: !live, limit });

console.log(JSON.stringify(report, null, 2));

// A dry run that somehow reported a write is a defect, not a note in a log.
if (!live && report.dbWrites !== 0) {
  console.error('FATAL: dry run reported a persistence write');
  process.exit(1);
}
