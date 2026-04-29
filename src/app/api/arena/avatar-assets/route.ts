/**
 * GET /api/arena/avatar-assets
 *
 * Returns avatar-assets catalog: character/outfit/accessory ID lists (JSON 본문 그대로).
 * Source: lib/bty/arena/data/avatar-assets.json ↔ public/avatars/avatar-assets.json.
 * Auth: none. Cache-Control: public, max-age=300.
 */
import { NextResponse } from "next/server";
import data from "@/lib/bty/arena/data/avatar-assets.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = new Headers();
  headers.set("Cache-Control", "public, max-age=300, s-maxage=300");

  return NextResponse.json(data, { status: 200, headers });
}
