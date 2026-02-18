import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// GET: List all users. Scope: ?orgId= & regionId= (minRole: regional_manager)
export async function GET(req: NextRequest) {
  const res = NextResponse.next();
  const auth = await requireAdmin(req, res, { minRole: "regional_manager" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: res.headers });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503, headers: res.headers });
  }

  try {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: res.headers });
    }
    const safeUsers = (data.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
    }));
    return NextResponse.json({ users: safeUsers }, { headers: res.headers });
  } catch (err: unknown) {
    console.error("[admin/users] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch users" },
      { status: 500, headers: res.headers }
    );
  }
}

// POST: Create new user. Scope: ?orgId= & regionId= (minRole: regional_manager)
export async function POST(req: NextRequest) {
  const res = NextResponse.next();
  const auth = await requireAdmin(req, res, { minRole: "regional_manager" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: res.headers });
  const body = await req.json().catch(() => ({}));

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503, headers: res.headers });
  }

  try {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { error: "이메일과 비밀번호(6자 이상)를 입력해주세요." },
        { status: 400, headers: res.headers }
      );
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      if (error.message.includes("already been registered")) {
        return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409, headers: res.headers });
      }
      return NextResponse.json({ error: error.message }, { status: 400, headers: res.headers });
    }

    return NextResponse.json(
      {
        user: {
          id: data.user?.id,
          email: data.user?.email,
          created_at: data.user?.created_at,
        },
      },
      { headers: res.headers }
    );
  } catch (err: unknown) {
    console.error("[admin/users] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create user" },
      { status: 500, headers: res.headers }
    );
  }
}

// DELETE: Delete user. Scope: ?orgId= & regionId=
export async function DELETE(req: NextRequest) {
  const res = NextResponse.next();
  const auth = await requireAdmin(req, res, { minRole: "regional_manager" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: res.headers });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503, headers: res.headers });
  }

  try {
    const { searchParams } = req.nextUrl;
    const userId = searchParams.get("id");
    const email = searchParams.get("email");

    if (!userId && !email) {
      return NextResponse.json({ error: "id 또는 email이 필요합니다." }, { status: 400, headers: res.headers });
    }

    let uid = userId;
    if (!uid && email) {
      const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const found = data.users?.find((u) => u.email === email);
      uid = found?.id ?? null;
    }

    if (!uid) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404, headers: res.headers });
    }

    const { error } = await supabase.auth.admin.deleteUser(uid);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: res.headers });
    }

    return NextResponse.json({ success: true, deleted: { id: uid } }, { headers: res.headers });
  } catch (err: unknown) {
    console.error("[admin/users] DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete user" },
      { status: 500, headers: res.headers }
    );
  }
}

// PATCH: Update user password. Scope: ?orgId= & regionId=
export async function PATCH(req: NextRequest) {
  const res = NextResponse.next();
  const auth = await requireAdmin(req, res, { minRole: "regional_manager" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: res.headers });
  const body = await req.json().catch(() => ({}));

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503, headers: res.headers });
  }

  try {
    const userId = body.id;
    const email = body.email;
    const newPassword = body.password;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 6자 이상이어야 합니다." },
        { status: 400, headers: res.headers }
      );
    }

    let uid = userId;
    if (!uid && email) {
      const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const found = data.users?.find((u) => u.email === email);
      uid = found?.id ?? null;
    }

    if (!uid) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404, headers: res.headers });
    }

    const { data, error } = await supabase.auth.admin.updateUserById(uid, {
      password: newPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: res.headers });
    }

    return NextResponse.json(
      {
        success: true,
        user: { id: data.user?.id, email: data.user?.email },
      },
      { headers: res.headers }
    );
  } catch (err: unknown) {
    console.error("[admin/users] PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update password" },
      { status: 500, headers: res.headers }
    );
  }
}
