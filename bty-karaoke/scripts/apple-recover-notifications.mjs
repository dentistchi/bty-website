// BUILD 26U-R4E-R3-R1 — the on-demand recovery operator.
//
// Operator-invoked only. There is no scheduler, no cron, and nothing in any request path calls
// this. It fetches notifications Apple already sent, verifies each exactly as a live delivery is
// verified, and replays them through the SAME canonical handler.
//
//   npx tsx scripts/apple-recover-notifications.mjs --env Sandbox --days 7
//   npx tsx scripts/apple-recover-notifications.mjs --env Sandbox --days 30 --transaction 2000001226703140
//
// `--env` is REQUIRED and explicit. There is no inferred default, because a recovery run pointed
// at the wrong environment is a silent no-op that looks like success.
import { readFileSync } from 'node:fs';

// .dev.vars into the environment, so the server module reads credentials the way it does in the
// Worker. Quoted multiline values (a .p8 pasted verbatim) are supported.
const raw = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
{
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trim();
    if (!t || t.startsWith('#')) continue;
    const eq = lines[i].indexOf('=');
    if (eq < 0) continue;
    const k = lines[i].slice(0, eq).trim();
    let v = lines[i].slice(eq + 1);
    const q = v.trim()[0];
    if (q === '"' || q === "'") {
      let acc = v.trim().slice(1);
      if (acc.endsWith(q)) { process.env[k] ??= acc.slice(0, -1); continue; }
      while (++i < lines.length) {
        const n = lines[i].trimEnd();
        if (n.endsWith(q)) { acc += `\n${n.slice(0, -1)}`; break; }
        acc += `\n${lines[i]}`;
      }
      process.env[k] ??= acc;
    } else process.env[k] ??= v.trim();
  }
}

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 && i + 1 < args.length ? args[i + 1] : null; };

const environment = arg('--env');
if (environment !== 'Sandbox' && environment !== 'Production') {
  console.error('BLOCKED — --env must be exactly Sandbox or Production (no default).');
  process.exit(2);
}
const days = Number(arg('--days') ?? '7');
if (!Number.isFinite(days) || days <= 0) { console.error('BLOCKED — --days must be a positive number.'); process.exit(2); }

const { recoverAppleNotifications, NOTIFICATION_HISTORY_RETENTION_DAYS } =
  await import('../src/lib/apple-notification-recovery.server.ts');

const limit = NOTIFICATION_HISTORY_RETENTION_DAYS[environment];
if (days > limit) {
  console.error(`BLOCKED — Apple retains ${environment} notification history for ${limit} days; `
    + `${days} is outside the window and would silently return nothing for the older part.`);
  process.exit(2);
}

const endDate = Date.now();
const startDate = endDate - days * 24 * 60 * 60 * 1000;
const transactionId = arg('--transaction') ?? undefined;

console.log(`\nBUILD 26U-R4E-R3-R1 — notification recovery`);
console.log(`  environment : ${environment}`);
console.log(`  window      : ${new Date(startDate).toISOString()} .. ${new Date(endDate).toISOString()} (${days}d, Apple retains ${limit}d)`);
console.log(`  transaction : ${transactionId ?? '(all)'}\n`);

const report = await recoverAppleNotifications({ environment, startDate, endDate, transactionId });
if (!report.ok) { console.error(`  FAILED — ${report.error}`); process.exit(3); }

console.log(`  pages ${report.pages}  fetched ${report.fetched}  verified ${report.verified}`);
console.log(`  applied ${report.applied}  duplicates ${report.duplicates}  ignored ${report.ignored}`);
console.log(`  unverifiable ${report.unverifiable}  failed ${report.failed}`);
for (const d of report.details) console.log(`    - ${d}`);
console.log();
process.exit(report.failed > 0 ? 4 : 0);
