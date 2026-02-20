import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

function setAuthDiagHeaders(out: NextResponse, cookieHeader: string, cookieNames: string) {
  out.headers.set("x-auth-diag-cookie-header", cookieHeader ? "1" : "0");
  out.headers.set("x-auth-diag-cookie-names", cookieNames || "none");
}

export async function GET(req: NextRequest) {
  // ✅ diag: request cookie 헤더가 실제로 서버에 도착하는지 확인
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieNames =
    cookieHeader
      .split(";")
      .map((p) => p.trim().split("=")[0])
      .filter(Boolean)
      .slice(0, 50)
      .join(",") || "none";

  try {
    const supabase = await getSupabaseServer();

    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      const out = NextResponse.json(
        { ok: false, error: "Auth session missing!" },
        { status: 401 }
      );
      setAuthDiagHeaders(out, cookieHeader, cookieNames);
      return out;
    }

    const out = NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
    setAuthDiagHeaders(out, cookieHeader, cookieNames);
    return out;
  } catch (err) {
    console.error("SESSION GET ERROR:", err);
    const out = NextResponse.json(
      { ok: false, error: "Session route crashed" },
      { status: 200 }
    );
    setAuthDiagHeaders(out, cookieHeader, cookieNames);
    return out;
  }
}
