export const runtime = "edge";

export async function GET() {
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  const body = {
    runtimeEnv: {
      hasSupabaseUrl,
      hasAnonKey,
      hasServiceRole,
    },
    nodeCompat: typeof process !== "undefined" && typeof process.env !== "undefined",
    // 하위 호환: admin/login이 hasUrl, hasAnon으로 체크
    hasUrl: hasSupabaseUrl,
    hasAnon: hasAnonKey,
  };

  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}
