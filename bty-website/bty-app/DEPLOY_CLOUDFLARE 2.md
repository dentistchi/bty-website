# Cloudflare Pages Deployment Guide

This guide covers deploying `bty-app` to Cloudflare Pages using `@cloudflare/next-on-pages`.

## Prerequisites

- Cloudflare account
- GitHub repository access (use existing `bty-website` repository - no need to create new repo)
- Azure AD (Entra ID) app registration (for admin authentication)
- Supabase project (for database)

## Repository Setup

**Use the existing `bty-website` repository** - this is a monorepo containing:
- `/bty-app` - Next.js app (to be deployed to Cloudflare Pages)
- `/bty-ai-core` - Backend API (deployed separately)
- `/bty-bot` - Bot Framework bot (deployed separately)

Cloudflare Pages supports monorepos. You'll configure the root directory in build settings.

## Build Configuration

### Build Settings

- **Build command**: `npm run build:cf`
- **Build output directory**: `.vercel/output/static`
- **Node version**: 20
- **Root directory**: `/bty-app` (if monorepo)

### Environment Variables

All required environment variables are listed in `env.example`. Add them in Cloudflare Pages dashboard:

```
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
BTY_ADMIN_EMAILS=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

**Important Notes:**
- `NEXTAUTH_URL` must be set to your deployed Pages URL: `https://<project>.pages.dev`
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to client; only used in server routes
- After first deploy, update `NEXTAUTH_URL` to the actual deployed URL and redeploy

## Deployment Steps

### 1. Connect Repository

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Pages** → **Create a project**
2. Connect your GitHub repository
3. **Select the existing `bty-website` repository** (this is a monorepo)
4. Cloudflare will detect it's a monorepo and allow you to set the root directory

### 2. Configure Build Settings

**Important**: Since `bty-website` is a monorepo, you must configure the root directory:

1. **Project name**: Choose a name (e.g., `bty-app` or `bty-website-app`)
2. **Production branch**: `main` (or your default branch)
3. **Path** (in Advanced settings): **Set to `bty-app`** ⚠️ **CRITICAL** - This tells Cloudflare to build from the `/bty-app` folder
4. **Build command**: `npm run build:cf`
5. **Build output directory**: `.vercel/output/static`
6. **Deploy command**: 
   - If required field: Use `echo "Deploy handled by Cloudflare Pages"` (this command won't actually run)
   - Or: Leave empty if allowed (Cloudflare Pages handles deployment automatically via GitHub)
   - **Note**: For GitHub-connected projects, deploy command is often ignored. The actual deployment happens when you push to GitHub.
7. **Node version**: **20** ⚠️ **CRITICAL** - Must be 20, not 18
   - Many packages require Node 20 (`@supabase/supabase-js`, `wrangler`, etc.)
   - If set to 18, build may succeed but runtime will fail

**⚠️ Common Mistakes**: 
- **Path = `/`**: Cloudflare will try to build from repository root, which will fail because `package.json` and build files are in `/bty-app`. Always set Path to `bty-app` for monorepos.
- **Node version = 18**: Build may succeed but runtime will fail with "Unsupported engine" errors. Must be Node 20.

**Note**: The root directory setting is crucial for monorepos. It tells Cloudflare Pages to:
- Run `npm install` in `/bty-app` directory
- Execute build command from `/bty-app` directory
- Use `/bty-app/package.json` for dependencies

### 3. Set Environment Variables

1. Go to **Settings** → **Environment variables**
2. Add all variables from `env.example`:
   - For **Production** environment, add all variables
   - For **Preview** environments, you can use the same or different values

**Required Variables:**
- `AZURE_AD_CLIENT_ID`: Azure AD application client ID
- `AZURE_AD_CLIENT_SECRET`: Azure AD application secret
- `AZURE_AD_TENANT_ID`: Azure AD tenant ID
- `NEXTAUTH_URL`: **Must be** `https://<your-project>.pages.dev` (update after first deploy)
- `NEXTAUTH_SECRET`: Generate a random secret (e.g., `openssl rand -base64 32`)
- `BTY_ADMIN_EMAILS`: Comma-separated list of admin emails
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (server-only)

### 4. Initial Deploy

1. Click **Deploy** button
2. Cloudflare will:
   - Connect to your GitHub repository
   - Clone the repo
   - Run build in the `bty-app` directory
   - Deploy the built files
3. You'll see a new deployment window/tab open
4. Wait for build to complete (usually 2-5 minutes)
5. Once complete, note your deployment URL: `https://<project-name>.pages.dev`

**Note**: If you see "Deploy" button and it opens a new deployment window, that's normal. Cloudflare is starting the build process. The actual deployment happens automatically after the build completes.

### 5. Update NEXTAUTH_URL and Azure AD Redirect URI

After first deployment:

1. **Update NEXTAUTH_URL**:
   - Go to Cloudflare Pages → Your project → **Settings** → **Environment variables**
   - Update `NEXTAUTH_URL` to: `https://<your-project>.pages.dev`
   - Save and trigger a new deployment

2. **Update Azure AD Redirect URI**:
   - Go to [Azure Portal](https://portal.azure.com) → **Azure Active Directory** → **App registrations**
   - Select your app registration
   - Go to **Authentication** → **Redirect URIs**
   - Add: `https://<your-project>.pages.dev/api/auth/callback/azure-ad`
   - Save

### 6. Redeploy

After updating environment variables:
- Cloudflare Pages will automatically trigger a new deployment, OR
- Go to **Deployments** → **Retry deployment** on the latest build

## Verification

### 1. Check Deployment Status

Visit: `https://<your-project>.pages.dev/api/deploy/ready`

Expected response:
```json
{
  "ok": true,
  "missing": [],
  "present": ["NEXTAUTH_URL", "NEXTAUTH_SECRET", ...],
  "critical_missing": [],
  "runtime": "edge",
  "timestamp": "2024-..."
}
```

If `ok: false`, check `critical_missing` array for missing environment variables.

### 2. Test Admin Dashboard

1. Visit: `https://<your-project>.pages.dev/admin/quality`
2. You should be redirected to Azure AD login (or credentials fallback)
3. After login, verify:
   - Quality events dashboard loads
   - Database connection works
   - No "Database Configuration Missing" warning

### 3. Test Login Flow

1. Visit admin page: `https://<your-project>.pages.dev/admin/quality`
2. Should redirect to: `https://<your-project>.pages.dev/api/auth/signin`
3. After Azure AD login, callback should work: `https://<your-project>.pages.dev/api/auth/callback/azure-ad`
4. Should redirect back to `/admin/quality` with authenticated session

## Troubleshooting

### Build Succeeds But Site Shows "로딩 중…" Only

**Most Common Cause**: Node.js version mismatch

**Symptoms**:
- Build logs show: `npm warn EBADENGINE Unsupported engine { required: { node: '>=20.0.0' } }`
- Build completes successfully
- Site loads but shows "로딩 중…" and nothing else

**Solution**:
1. Cloudflare Dashboard → Your project → **Settings** → **Builds & deployments**
2. Find **Node version** setting
3. Change from **18** to **20**
4. Save settings
5. Go to **Deployments** → **Retry deployment** on latest build
6. Wait for new deployment to complete

**Also update `package.json`**:
```json
"engines": {
  "node": ">=20"
}
```

### Build Fails

- **Error**: `@cloudflare/next-on-pages` not found
  - **Solution**: Ensure `@cloudflare/next-on-pages` is in `devDependencies`

- **Error**: Build output not found
  - **Solution**: Verify build command is `npm run build:cf` and output directory is `.vercel/output/static`

- **Error**: "Unsupported engine" warnings during build
  - **Solution**: Set Node version to 20 in Cloudflare Dashboard settings

### Runtime Errors

- **Error**: `NEXTAUTH_URL` mismatch
  - **Solution**: Ensure `NEXTAUTH_URL` exactly matches your Pages URL (including `https://`)

- **Error**: Database connection fails
  - **Solution**: Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly
  - Verify Supabase project is accessible

### Authentication Issues

- **Error**: Redirect URI mismatch
  - **Solution**: Ensure Azure AD redirect URI matches: `https://<project>.pages.dev/api/auth/callback/azure-ad`

- **Error**: Session not persisting
  - **Solution**: Check `NEXTAUTH_SECRET` is set and `NEXTAUTH_URL` matches deployed URL

## Local Testing

Before deploying, test locally:

```bash
cd bty-app
npm run build:cf
npm run preview:cf
```

Visit `http://localhost:8788` and verify:
- Admin dashboard loads
- Authentication works
- Database connections work

## Additional Notes

- **Runtime**: Most API routes use `edge` runtime. NextAuth route uses `nodejs` runtime.
- **Environment Variables**: Never commit `.env.local` or actual secrets to git.
- **Service Role Key**: `SUPABASE_SERVICE_ROLE_KEY` is server-only and never exposed to client.
- **Build Output**: The build creates `.vercel/output/static` directory with static assets.

## Support

For issues:
1. Check `/api/deploy/ready` endpoint for missing env vars
2. Review Cloudflare Pages build logs
3. Verify environment variables are set correctly
4. Check Azure AD app registration settings
