# Auth & deployment safety — stabilization summary

**Owner:** Auth & deployment safety (BTY Arena)  
**Constraints:** No domain rules changes. No DB schema redesign unless required for auth. Minimal, defensive changes only.

---

## 1) Current risk summary

| Risk | Severity | Location | Notes |
|------|----------|----------|--------|
| **OAuth callback not persisting session** | High | `src/app/api/auth/callback/route.ts` | Used `getSupabaseServer()` whose `setAll` is no-op; `exchangeCodeForSession` succeeded in memory but cookies were never written to the response → redirect without session, login loop. |
| **Callback redirect targets wrong path** | Medium | Same | Redirected to `/login?...`; app uses locale routes (`/en/bty/login`, `/ko/bty/login`). |
| **Logout API vs middleware logout path** | Low | `api/auth/logout`, `middleware.ts` | Both set `Clear-Site-Data: "cookies"` and expire auth cookies; middleware also calls `expireAuthCookiesHard` on `/[locale]/bty/logout`. Ensure all auth cookie names (including chunks) are cleared. |
| **Edge vs Node cookie handling** | Low | Middleware (Edge) vs API routes (Node) | Middleware runs on Edge; auth API routes use `nodejs` runtime where set. Cookie options (Path=/, SameSite=Lax, Secure) aligned; no domain set (host-only). |
| **OpenNext / Workers compatibility** | Low | Build/deploy | No `runtime = "edge"` in auth routes; cookie writes use `NextResponse` with explicit options. |

---

## 2) Proposed changes (minimal)

- **Callback route**
  - **Before:** `getSupabaseServer()` → `exchangeCodeForSession(code)` → redirect. Session was never written to cookies.
  - **After:** `createServerClient` with cookie capture (getAll from `req`, setAll into array) → `exchangeCodeForSession(code)` → redirect response with `expireAuthCookiesHard(req, res)` + `writeSupabaseAuthCookies(res, captured)`. Redirect target: `/en/bty/login` (or sanitized `next`).
- **No runtime change:** Callback already had `runtime = "nodejs"`. No edge/node switch.
- **No middleware change:** Cookie options already Path=/, SameSite=Lax, Secure, no domain. Logout path already clears cookies.

---

## 3) Patch plan (file paths)

| File | Change |
|------|--------|
| `bty-app/src/app/api/auth/callback/route.ts` | Use `createServerClient` with cookie capture; call `expireAuthCookiesHard` + `writeSupabaseAuthCookies` on redirect response; redirect to locale-aware `/en/bty/login` or sanitized `next`. |

**Not changed (by design):**

- `src/middleware.ts` — already sets cookies with Path=/, SameSite=Lax, Secure; logout path clears cookies.
- `src/app/api/auth/logout/route.ts` — already sets Clear-Site-Data and calls `expireAuthCookiesHard`.
- `src/app/api/auth/session/route.ts` — already normalizes cookies (Path=/) on POST.
- `src/lib/auth/**` — not used for Supabase cookie logic (cookie helpers live under `lib/bty/cookies/`).
- Deployment config — no change; no cookie/domain config in `wrangler.toml`.

---

## 4) Verification checklist

### Local

- [ ] **Login (password):** `POST /api/auth/login` with valid credentials → 200, response has `Set-Cookie` with `sb-*-auth-token*`, Path=/, Secure; then `GET /api/auth/session` → 200, `ok: true`.
- [ ] **Logout (API):** `POST /api/auth/logout` (with auth cookies) → 200, response has `Clear-Site-Data: "cookies"` and Set-Cookie clearing auth cookies; then `GET /api/auth/session` → 200, `ok: false`.
- [ ] **Logout (page):** Visit `/[locale]/bty/logout` → redirect to login; cookies cleared (e.g. in DevTools Application → Cookies).
- [ ] **Callback (OAuth):** If using OAuth, redirect to `GET /api/auth/callback?code=...&next=/en/bty/dashboard` → redirect to `/en/bty/dashboard` with Set-Cookie for auth tokens; then `GET /api/auth/session` → 200, `ok: true`.
- [ ] **Whoami:** `GET /api/auth/whoami` with auth cookies → auth cookie names/count in body.

### Preview (e.g. workers.dev)

- [ ] Same as local on `https://<worker>.workers.dev`: login → session → logout (API and page) → cookies cleared.
- [ ] Callback (if used) on preview URL: session persists after redirect.

### Prod

- [ ] Login → dashboard → logout (UI) → confirm redirect to login and cookies gone.
- [ ] `POST /api/auth/logout` with session → 200, then next request unauthenticated.

### Rollback

- **If callback change causes issues:** Revert `src/app/api/auth/callback/route.ts` to previous version (use `getSupabaseServer()` and redirect to `/login`). OAuth flow will again not persist server-side session (client-side callback at `[locale]/auth/callback` can still work if it runs `exchangeCodeForSession` in browser).

---

## 5) Next steps checklist

- [ ] Run local verification (login, logout, session, callback if applicable).
- [ ] Deploy to preview and repeat checks.
- [ ] After prod deploy: smoke-test login and logout once.
- [ ] (Optional) Add a single E2E or API test for “login → session 200 → logout → session 401/ok:false” to guard regressions.
- [ ] (Optional) Remove or gate debug headers (`x-cookie-writer`, `x-auth-expire-*`, etc.) in production if desired; document in CONTEXT.md.
