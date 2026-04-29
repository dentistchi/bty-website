import { NextResponse } from "next/server";

export async function GET() {
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return NextResponse.json({
    ok: true,
    runtimeEnv: {
      hasSupabaseUrl: hasUrl,
      hasSupabaseAnon: hasAnon,
      hasServiceRole,
    },
  });
}
