/**
 * GET /api/arena/avatar-assets
 *
 * Returns avatar-assets catalog: character/outfit/accessory ID lists.
 * Source: same as lib (avatar-assets.data ↔ public/avatars/avatar-assets.json).
 * No auth required so clients can load catalog for UI before or after login.
 */
import { NextResponse } from "next/server";
import data from "@/lib/bty/arena/data/avatar-assets.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = new Headers();
  headers.set("Cache-Control", "public, max-age=300, s-maxage=300");

  return NextResponse.json(data, { status: 200, headers });
}
