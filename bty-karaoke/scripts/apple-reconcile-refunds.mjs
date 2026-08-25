// BUILD 26U-R4G-R2-R1 — the retention-safe reconciliation operator.
//
// The THIRD line of defence, after the live notification and Notification History recovery. It
// asks Apple what the financial truth is NOW, compares it with what BTY recorded, and writes only
// where both agree. Operator-invoked; nothing in any request path calls it.
//
//   npx tsx scripts/apple-reconcile-refunds.mjs --env Sandbox --dry-run
//   npx tsx scripts/apple-reconcile-refunds.mjs --env Sandbox
//   npx tsx scripts/apple-reconcile-refunds.mjs --env Production --transaction 2000001226703140
//
// `--env` is REQUIRED and explicit: a run pointed at the wrong environment is a silent no-op that
// looks like success.
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
const flag = (name) => args.includes(name);

const environment = arg('--env');
if (environment !== 'Sandbox' && environment !== 'Production') {
  console.error('BLOCKED — --env must be exactly Sandbox or Production (no default).');
  process.exit(2);
}
const dryRun = flag('--dry-run');
const transactionId = arg('--transaction') ?? undefined;
const accountId = arg('--account') ?? undefined;
const limitRaw = arg('--limit');
const limit = limitRaw == null ? undefined : Number(limitRaw);
if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
  console.error('BLOCKED — --limit must be a positive integer.');
  process.exit(2);
}

const { reconcileAppleRefunds } =
  await import('../src/lib/apple-refund-reconciliation.server.ts');

console.log(`\nBUILD 26U-R4G-R2-R1 — Apple financial reconciliation`);
console.log(`  environment : ${environment}`);
console.log(`  scope       : ${transactionId ?? accountId ?? 'all local paid purchases'}${limit ? ` (limit ${limit})` : ''}`);
console.log(`  mode        : ${dryRun ? 'DRY RUN — Apple is called, NOTHING is written' : 'APPLY'}\n`);

const report = await reconcileAppleRefunds({ environment, transactionId, accountId, limit, dryRun });
if (!report.ok) { console.error(`  FAILED — ${report.error}\n`); process.exit(3); }

console.log(`  seeds ${report.seeds}  history pages ${report.historyPages}  candidates ${report.candidates}`);
console.log(`  no action ${report.noAction}  already applied ${report.alreadyApplied}  reversed before we saw it ${report.reversedBeforeWeSaw}`);
console.log(`  refunds ${dryRun ? 'that WOULD apply' : 'applied'} ${report.appliedRefunds}  reversals ${dryRun ? 'that WOULD apply' : 'applied'} ${report.appliedReversals}`);
console.log(`  unverifiable ${report.unverifiable}  UNRESOLVED ${report.unresolved}`);
for (const o of report.outcomes) console.log(`    - ${o.action.padEnd(34)} ${o.transactionId}  ${o.detail}`);
console.log();

// THE EXIT STATUS IS THE POINT. A run that prints counts and exits 0 is read as "nothing needs a
// human". Anything ambiguous, conflicting, unverifiable or unbound makes that untrue, so it exits
// non-zero and names what to look at — a legacy shape that cannot be told apart from a reversal
// included. That branch is a safety feature, not a bug.
if (report.unresolved > 0) {
  console.error(`  UNRESOLVED — ${report.unresolved} candidate(s) need a human. Nothing was guessed.\n`);
  process.exit(4);
}
if (dryRun && (report.appliedRefunds > 0 || report.appliedReversals > 0)) {
  console.log('  DRY RUN — re-run without --dry-run to apply the above.\n');
}
process.exit(0);
