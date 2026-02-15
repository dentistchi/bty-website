export const runtime = "edge";

export async function GET() {
  return Response.json({
    ok: true,
    runtimeEnv: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    buildInfo: {},
  });
}
