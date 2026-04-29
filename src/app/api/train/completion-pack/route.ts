import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-server";
import { buildCompletionPackFromLesson } from "@/lib/train/completion-pack";

// ✅ 레슨 데이터(영어 베이스) import
// 네가 만들어둔 영어 JSON을 프로젝트에 넣어둔 경로로 맞춰줘.
// 예: bty-app/src/content/train-28days.en.json
import lessons from "@/content/train-28days.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.append("Vary", "Cookie");
  return res;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req as unknown as Request);
  if (!user) return noStore(NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }));

  const { searchParams } = new URL(req.url);
  const day = Number(searchParams.get("day") ?? "0");
  if (!day || day < 1 || day > 28) {
    return noStore(NextResponse.json({ ok: false, error: "Invalid day" }, { status: 400 }));
  }

  // lessons 구조가 {"1": {...}} 형태라고 가정
  const lesson = (lessons as any)[String(day)];
  if (!lesson) {
    return noStore(NextResponse.json({ ok: false, error: "Lesson not found" }, { status: 404 }));
  }

  const pack = buildCompletionPackFromLesson({
    day: lesson.day ?? day,
    title: lesson.title ?? "",
    sections: lesson.sections ?? {},
  });

  return noStore(NextResponse.json({ ok: true, pack }, { status: 200 }));
}
