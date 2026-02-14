export const runtime = "edge";

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    site: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  });
}
