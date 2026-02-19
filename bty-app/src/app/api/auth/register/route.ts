import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

const DEFAULT_ORG_ID = "11196cff-205e-4a58-aedc-289089ea4b07";

function copySetCookies(from: NextResponse, to: NextResponse) {
  const getter = (from.headers as any).getSetCookie?.bind(from.headers);
  if (getter) {
    const cookies: string[] = getter() || [];
    cookies.forEach((c) => to.headers.append("set-cookie", c));
    return;
  }
  const single = from.headers.get("set-cookie");
  if (single) to.headers.append("set-cookie", single);
}

export async function POST(req: NextRequest) {
  // ✅ 쿠키를 심기 위한 "템플릿 응답"
  const cookieRes = NextResponse.json({ ok: false }, { status: 200 });
  const supabase = getSupabaseServer(req, cookieRes);
  if (!supabase) {
    return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 });
  }
  const { email, password } = await req.json();

  if (!email || !password || password.length < 6) {
    return NextResponse.json(
      { error: "이메일과 비밀번호(6자 이상)를 입력해주세요." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "회원가입 실패" }, { status: 500 });
  }

  // 프로필 설정
  const { data: existing } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (existing) {
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ organization_id: DEFAULT_ORG_ID })
      .eq("id", data.user.id);

    if (updateErr) {
      console.error("[auth/register] Profile update error:", updateErr);
      return NextResponse.json(
        { error: "프로필 생성 실패" },
        { status: 500 }
      );
    }
  } else {
    const { error: insertErr } = await supabase.from("profiles").insert({
      id: data.user.id,
      organization_id: DEFAULT_ORG_ID,
      role: "staff",
    });

    if (insertErr) {
      console.error("[auth/register] Profile insert error:", insertErr);
      return NextResponse.json(
        { error: "프로필 생성 실패" },
        { status: 500 }
      );
    }
  }

  // ✅ access_token과 refresh_token을 프론트엔드에 반환
  // 프론트엔드에서 /api/auth/session POST로 쿠키 세션을 설정하도록 함
  const successRes = NextResponse.json({
    ok: true,
    access_token: data.session?.access_token ?? null,
    refresh_token: data.session?.refresh_token ?? null,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  });

  // ✅ cookieRes에 심긴 Set-Cookie를 successRes로 복사
  copySetCookies(cookieRes, successRes);

  return successRes;
}
