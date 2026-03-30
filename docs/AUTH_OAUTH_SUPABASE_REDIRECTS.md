# Supabase Auth — Site URL & OAuth redirects (operator)

Configure in **Supabase Dashboard → Authentication → URL configuration**.

1. **Site URL**  
   Set to the **production** app origin (e.g. `https://bty.app`).  
   Avoid leaving the default that drops users on `/` without a locale unless middleware preserves query (see `bty-app/src/middleware.ts` bare `/` → `/en`).

2. **Redirect URLs (allowlist)** — add at least:

   - `https://<prod-host>/en/auth/callback`
   - `https://<prod-host>/ko/auth/callback`
   - `http://localhost:3000/en/auth/callback`
   - `http://localhost:3000/ko/auth/callback`

   Optional (PKCE via API route): `https://<prod-host>/api/auth/callback`

3. **Google OAuth** (or other provider): enable under **Authentication → Providers** and set client ID/secret.

App code: BTY login uses `signInWithOAuth` with  
`redirectTo = ${origin}/${locale}/auth/callback?next=<encoded path>`  
(e.g. default next `/${locale}/bty-arena`). After exchange, `sanitizeAuthCallbackNext` applies the same rules as `GET /api/auth/callback`.
