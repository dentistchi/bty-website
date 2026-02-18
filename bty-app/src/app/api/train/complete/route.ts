import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.append("Vary", "Cookie");
  return res;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const day = Number(body?.day);

  if (!Number.isFinite(day) || day < 1 || day > 28) {
    return noStore(NextResponse.json({ ok: false, error: "invalid day" }, { status: 400 }));
  }

  // ✅ 임시: DB 저장은 다음 단계.
  // 지금은 ok만 내려서 UI 플로우가 살아있는지 확인
  return noStore(NextResponse.json({ ok: true }, { status: 200 }));
}
