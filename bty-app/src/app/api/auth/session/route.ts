import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

function setAuthDiagHeaders(out: NextResponse, cookieHeader: string, cookieNames: string) {
  out.headers.set("x-auth-diag-cookie-header", cookieHeader ? "1" : "0");
  out.headers.set("x-auth-diag-cookie-names", cookieNames || "none");
}

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookieNames = req.cookies.getAll().map((c) => c.name).join(","); // 값 노출 X

  try {
    const res = NextResponse.json({ ok: false });
    const supabase = getSupabaseServer(req, res);

    if (!supabase) {
      const out = NextResponse.json(
        { ok: false, error: "Server not configured" },
        { status: 503 }
      );
      setAuthDiagHeaders(out, cookieHeader, cookieNames);
      return out;
    }

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
