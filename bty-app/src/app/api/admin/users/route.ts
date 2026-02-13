import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  findUserByEmail,
  findUserById,
  createUser,
  getAllUsers,
  deleteUser,
  updateUserPassword,
} from "@/lib/auth-store";
import { signToken } from "@/lib/auth";

export const runtime = "nodejs";

// Simple hash function (same as login/register routes)
function simpleHash(password: string): string {
  let h = 0;
  for (let i = 0; i < password.length; i++) {
    h = (h << 5) - h + password.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

// GET: List all users
export async function GET(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const users = getAllUsers();
    // Don't expose password hashes
    const safeUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      createdAt: u.createdAt,
    }));
    return NextResponse.json({ users: safeUsers });
  } catch (err: unknown) {
    console.error("[admin/users] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST: Create new user
export async function POST(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { error: "이메일과 비밀번호(6자 이상)를 입력해주세요." },
        { status: 400 }
      );
    }

    if (findUserByEmail(email)) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }

    const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const passwordHash = simpleHash(password);
    const user = createUser(id, email, passwordHash);

    return NextResponse.json({
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    });
  } catch (err: unknown) {
    console.error("[admin/users] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create user" },
      { status: 500 }
    );
  }
}

// DELETE: Delete user
export async function DELETE(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const userId = searchParams.get("id");
    const email = searchParams.get("email");

    if (!userId && !email) {
      return NextResponse.json({ error: "id 또는 email이 필요합니다." }, { status: 400 });
    }

    const user = userId ? findUserById(userId) : findUserByEmail(email!);
    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    deleteUser(user.id);
    return NextResponse.json({ success: true, deleted: { id: user.id, email: user.email } });
  } catch (err: unknown) {
    console.error("[admin/users] DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete user" },
      { status: 500 }
    );
  }
}

// PATCH: Update user password
export async function PATCH(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const userId = body.id;
    const email = body.email;
    const newPassword = body.password;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    const user = userId ? findUserById(userId) : email ? findUserByEmail(email) : null;
    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    const passwordHash = simpleHash(newPassword);
    updateUserPassword(user.id, passwordHash);

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
    });
  } catch (err: unknown) {
    console.error("[admin/users] PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update password" },
      { status: 500 }
    );
  }
}
