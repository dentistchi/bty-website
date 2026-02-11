import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/auth-store";
import { signToken } from "@/lib/auth";

export const runtime = "edge";

function simpleHash(password: string): string {
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

    if (!email || !password) {
      return NextResponse.json(
        { error: "이메일과 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    const user = findUserByEmail(email);
    if (!user || user.passwordHash !== simpleHash(password)) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 맞지 않아요." },
        { status: 401 }
      );
    }

    const token = await signToken({ sub: user.id, email: user.email });
    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "로그인 중 오류가 났어요." },
      { status: 500 }
    );
  }
}
