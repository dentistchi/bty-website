# Action contract escalation expiry — HTTP cron

**Endpoint:** `POST /api/cron/action-contract-escalation-expire`  
**Implementation:** `src/app/api/cron/action-contract-escalation-expire/route.ts`  
**Spec:** `VALIDATOR_ARCHITECTURE_V1` §3.5 — open human escalations past `expires_at` are marked expired; the contract returns to **`pending`** (not auto-approved).

## Auth

- **Header:** `Authorization: Bearer <CRON_SECRET>` **or** `x-cron-secret: <CRON_SECRET>`  
- **Env:** `CRON_SECRET` must match (same pattern as `POST /api/cron/tii-weekly`).

## Scheduling

- **GitHub Actions:** `.github/workflows/action-contract-escalation-expire-cron.yml` — runs **hourly** UTC (`0 * * * *`).  
- Requires repo secrets **`DEPLOY_URL`** (production app origin, no trailing slash) and **`CRON_SECRET`**.  
- If you deploy elsewhere (e.g. Cloudflare Workers cron), call the same URL with the same secret on a similar schedule.

## Production prerequisites

1. **`OPENAI_API_KEY`** — set on the **production** server (not only CI). Required for Layer 2 semantic validation and mentor/chat paths; see `docs/SECURITY.md` and `.env.example`.  
2. **`SUPABASE_SERVICE_ROLE_KEY`** — required for this cron (admin client updates `bty_action_contract_escalations` and `bty_action_contracts`).  
3. **Human escalation review UI** — tracked separately. **Do not** rely on production users hitting **`escalated`** until a human review path exists; otherwise escalations depend on **this cron** + SLA expiry and **`bty_action_contract_escalation_resolutions`** audit flows. Treat missing review UI as **operator blocking** for “full” escalation lifecycle.

## Verification

```bash
curl -sS -X POST "${DEPLOY_URL}/api/cron/action-contract-escalation-expire" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"
# Expect: {"ok":true,"expired":<n>}
```
