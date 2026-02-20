import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function parseCookieNames(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.split("=")[0])
    .filter(Boolean);
}

function isSupabaseCookieName(name: string) {
  return name.startsWith("sb-") || name.startsWith("__Secure-sb-");
}

function expireCookie(
  res: NextResponse,
  name: string,
  opts: { path: string; domain?: string }
) {
  res.cookies.set(name, "", {
    path: opts.path,
    ...(opts.domain != null && { domain: opts.domain }),
    sameSite: "lax",
    secure: true,
    httpOnly: true,
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const hostname = url.hostname;

    const res = NextResponse.json({ ok: true }, { status: 200 });

    res.headers.set("Clear-Site-Data", '"cookies"');

    const supabase = await getSupabaseServer();
    try {
      await supabase.auth.signOut();
    } catch {}

    const cookieHeader = req.headers.get("cookie") ?? "";
    const allNames = parseCookieNames(cookieHeader);
    const sbNames = uniq(allNames.filter(isSupabaseCookieName));

    const extraCandidates: string[] = [];
    for (const n of sbNames) {
      extraCandidates.push(`${n}.0`, `${n}.1`, `${n}.2`, `${n}.3`);
    }

    const targets = uniq([...sbNames, ...extraCandidates]).filter(isSupabaseCookieName);

    const paths = ["/", "/api"];
    const domains: (string | undefined)[] = [undefined, hostname];

    for (const name of targets) {
      for (const path of paths) {
        for (const domain of domains) {
          expireCookie(res, name, { path, domain });
        }
      }
    }

    res.headers.set("x-auth-logout-cookie-names", sbNames.join(",") || "none");

    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Logout failed" }, { status: 500 });
  }
}
