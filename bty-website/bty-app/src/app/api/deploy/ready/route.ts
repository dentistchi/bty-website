/**
 * Deployment readiness checker endpoint.
 * Returns status of required environment variables for admin + database.
 * Never returns actual secrets.
 */

export const runtime = "edge";

const REQUIRED_ENV_VARS = [
  // NextAuth
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  // Azure AD (optional if using credentials fallback)
  "AZURE_AD_CLIENT_ID",
  "AZURE_AD_CLIENT_SECRET",
  "AZURE_AD_TENANT_ID",
  // Admin
  "BTY_ADMIN_EMAILS",
  // Supabase
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const CRITICAL_ENV_VARS = [
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "BTY_ADMIN_EMAILS",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export async function GET() {
  const missing: string[] = [];
  const present: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      missing.push(key);
    } else {
      present.push(key);
    }
  }

  // ok=true only if all critical vars exist
  const criticalMissing = CRITICAL_ENV_VARS.filter((key) => missing.includes(key));
  const ok = criticalMissing.length === 0;

  // Detect runtime (edge vs nodejs)
  // In Cloudflare Pages, we're always in edge runtime unless explicitly set to nodejs
  const runtime = "edge";

  return Response.json({
    ok,
    missing,
    present,
    critical_missing: criticalMissing,
    runtime,
    timestamp: new Date().toISOString(),
  });
}
