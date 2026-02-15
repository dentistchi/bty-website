export const runtime = "edge";

export async function GET() {
  return new Response(
    JSON.stringify({
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      nodeEnv: process.env.NODE_ENV,
    }),
    { headers: { "content-type": "application/json" } }
  );
}
