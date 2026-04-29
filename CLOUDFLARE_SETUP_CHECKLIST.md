# Cloudflare Pages Setup Checklist

## ⚠️ Critical Settings

### Path Setting (MUST BE CORRECT)
- ❌ **Wrong**: Path = `/` (repository root)
- ✅ **Correct**: Path = `bty-app` (subdirectory)

**Why**: `bty-website` is a monorepo. Cloudflare needs to know to build from `/bty-app` folder, not the root.

### Build Settings
- ✅ **Build command**: `npm run build:cf`
- ✅ **Build output directory**: `.vercel/output/static`
- ✅ **Deploy command**: 
  - If UI shows "required": Use `echo "Deploy handled by Cloudflare Pages"` (dummy command, won't actually run)
  - If allowed to be empty: Leave empty
  - **Note**: For GitHub-connected projects, this is often ignored. Deployment happens automatically on git push.
- ✅ **Node version**: 20

### Environment Variables (Add in Settings → Environment variables)
Required variables (see `env.example`):
- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_CLIENT_SECRET`
- `AZURE_AD_TENANT_ID`
- `NEXTAUTH_URL` (set after first deploy)
- `NEXTAUTH_SECRET`
- `BTY_ADMIN_EMAILS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Quick Verification

After deployment, check:
1. Visit: `https://<your-project>.pages.dev/api/deploy/ready`
2. Should return: `{"ok": true, ...}`
3. If `ok: false`, check `critical_missing` array

## Troubleshooting

### Deploy command shows "required" error
- **Cause**: UI validation requires a value
- **Fix**: Use dummy command: `echo "Deploy handled by Cloudflare Pages"` (won't actually execute)

### Deploy button opens new window/tab
- **Cause**: Normal behavior - Cloudflare is starting the build process
- **Fix**: Wait for build to complete. Check the new deployment window for build logs.

### Build fails with "package.json not found"
- **Cause**: Path is set to `/` instead of `bty-app`
- **Fix**: Change Path to `bty-app` in Advanced settings

### Build fails with "@cloudflare/next-on-pages not found"
- **Cause**: Dependencies not installed
- **Fix**: Ensure `@cloudflare/next-on-pages` is in `devDependencies` in `bty-app/package.json`

### Build succeeds but site doesn't work
- **Cause**: Missing environment variables
- **Fix**: Check `/api/deploy/ready` endpoint and add missing variables
