import { NextResponse } from "next/server";
import { findUserByEmail, createUser } from "@/lib/auth-store";
import { signToken } from "@/lib/auth";

export const runtime = "nodejs";

function simpleHash(password: string): string {
  // Demo only. In production use bcrypt or similar.
  let h = 0;
  for (let i = 0; i < password.length; i++) {
    h = (h << 5) - h + password.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { error: "이메일과 비밀번호(6자 이상)를 입력해주세요." },
        { status: 400 }
      );
    }

    if (findUserByEmail(email)) {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다." },
        { status: 409 }
      );
    }

    const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const passwordHash = simpleHash(password);
    createUser(id, email, passwordHash);

    const token = await signToken({ sub: id, email });
    return NextResponse.json({
      token,
      user: { id, email },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "회원가입 중 오류가 났어요." },
      { status: 500 }
    );
  }
}
