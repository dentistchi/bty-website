# Release Log

---

## 2026-05-01 — Public Repo Secret Exposure Incident

**Trigger**: Initial commit (3957a68) pushed to public github.com/dentistchi/bty-app
contained .env with live credentials.

**Rotated**:
- Supabase service_role key (new key system, old key deleted)
- OpenAI API key (auto-revoked by GitHub secret scanning, new key issued)
- ARENA_ACTION_LOOP_QR_SECRET (rotated twice — first value was exposed in
  remediation chat, second is the current acdaa6... prefix)

**Discovered during remediation**:
1. opennextjs-cloudflare's `populateProcessEnv` bakes `.env.local` values into
   worker bundle at `cf:build` time. `LLM_BASE_URL=http://localhost:11434/v1`
   was getting baked, routing OpenAI calls to localhost. Fix: comment out
   dev-only env vars in `.env.local` before production build.
2. `wrangler secret put` accepts empty strings as success. `SUPABASE_SERVICE_ROLE_KEY`
   was set to `""` at one point during rotation; `populateProcessEnv` wrote `""` to
   `process.env`, and validate route's `!key.trim()` check returned `500 server_config_error`.
   Fix: verify variable length (`echo ${#VAR}`) before secret put; verify post-put
   via `/api/debug` endpoint `hasServiceRole: true`.

**Worker affected**: bty-arena-staging (sole production worker; "bty-website" in
older docs was the prior worker name — no longer exists on the account).

**Final state**: All secrets rotated, all 3 worker secrets verified non-empty,
mentor + validate routes confirmed live. Worker Version: 8a8fd1f0 → 7be041a7
(secret-only changes, no code redeploy required for the final fix).

**Issues closed in same session**:
- Issue A (QR completion link silent failure): UI surface error + HMAC secret rotation
- Issue B (Phase 4 completion signal absent): green completion banner + i18n keys

**Repo cleanup**: github.com/dentistchi/bty-app no longer exists on GitHub
(`gh repo view` returned "Could not resolve to a Repository"). Local history
was rewritten with git-filter-repo for hygiene; force push was skipped as
remote is absent. If a new remote is created later, the cleaned history
will be the basis. Separate finding: github.com/dentistchi/bty-website
emitted GitHub Security Tab alert for OpenAI key in js/chatbot.js —
unrelated to bty-app, OpenAI auto-revoked, tracked as separate audit
(see backlog #4).
