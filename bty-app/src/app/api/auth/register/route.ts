import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const DEFAULT_ORG_ID = "11196cff-205e-4a58-aedc-289089ea4b07";

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient();
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

  if (data.user) {
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
  }

  return NextResponse.json({
    user: data.user,
    session: data.session,
    profile: { organization_id: DEFAULT_ORG_ID },
  });
}
