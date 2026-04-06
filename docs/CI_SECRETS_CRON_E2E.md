# CI secrets: CRON + E2E cleanup wiring

**Purpose:** GitHub Actions cron jobs must send **`Authorization: Bearer <CRON_SECRET>`** to `POST /api/cron/*`. Playwright + local `next dev` in E2E need **`CRON_SECRET` and/or `E2E_TEST_CLEANUP_SECRET`** so `POST /api/test/cleanup-action-contracts` accepts the same Bearer as the test client.

## GitHub Actions repository secrets

| Secret | Used by | Notes |
| --- | --- | --- |
| **`DEPLOY_URL`** | `tii-weekly-cron.yml`, `action-contract-escalation-expire-cron.yml` | Deploy origin, **no** trailing slash (workflows normalize). Example: `https://your-app.workers.dev` |
| **`CRON_SECRET`** | Cron workflows + E2E job | Same string as **runtime** `CRON_SECRET` on OpenNext / Cloudflare Workers / Vercel |
| **`E2E_TEST_CLEANUP_SECRET`** (optional) | E2E workflow | If unset, **`e2e.yml`** falls back to **`CRON_SECRET`** so one secret is enough |

**Parity rule:** `CRON_SECRET` in GitHub **must equal** `CRON_SECRET` on the deployed app that receives cron requests. Otherwise cron returns **401**.

**E2E parity rule:** Playwright and the Next.js process started in CI must share the same cleanup secret as the server checks (`E2E_TEST_CLEANUP_SECRET` or `CRON_SECRET`). Set both env vars in the E2E job to the same value, or only `CRON_SECRET` and rely on fallback for `E2E_TEST_CLEANUP_SECRET`.

## Runtime secrets (deploy target)

| Variable | Where |
| --- | --- |
| **`CRON_SECRET`** | Cloudflare Workers / OpenNext env, Vercel env, etc. — **required** for `/api/cron/*` |

Optional: **`E2E_TEST_CLEANUP_SECRET`** on preview/staging if you want cleanup Bearer distinct from cron (same semantics as local).

## Verification checklist

1. **GitHub:** Repository → Settings → Secrets and variables → Actions — confirm **`DEPLOY_URL`**, **`CRON_SECRET`** (and optional **`E2E_TEST_CLEANUP_SECRET`**).
2. **Deploy dashboard:** Same project → Environment variables — confirm **`CRON_SECRET`** equals GitHub’s value (use a secure compare; do not paste secrets into chat).
3. **Manual cron probe (from operator machine):**  
   `curl -sS -X POST "$DEPLOY_URL/api/cron/tii-weekly" -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json"` → **200** (not 401).
4. **E2E CI:** Green `E2E` workflow with local `next dev` — Playwright cleanup runs without throwing **`E2E_TEST_CLEANUP_SECRET or CRON_SECRET required`**.

## Related code

- `bty-app/src/app/api/cron/tii-weekly/route.ts` — Bearer vs `process.env.CRON_SECRET`
- `bty-app/src/app/api/test/cleanup-action-contracts/route.ts` — `E2E_TEST_CLEANUP_SECRET || CRON_SECRET`
- `bty-app/e2e/helpers/cleanup-action-contracts.ts` — Playwright env
