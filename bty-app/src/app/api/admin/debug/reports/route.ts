import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireAdminEmail } from "@/lib/authz";

export const runtime = "nodejs";

const TITLE_MAX = 500;
const DESCRIPTION_MAX = 2000;
const CONTEXT_JSON_MAX = 5000;
const CONTEXT_KEYS_MAX = 20;

/** GET: list MVP debug reports (admin only when BTY_ADMIN_EMAILS set) */
export async function GET(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  const status = req.nextUrl.searchParams.get("status"); // open | resolved | (empty = all)

  let q = supabase
    .from("mvp_debug_reports")
    .select("id, title, description, context, route, status, created_by, created_at, updated_at, resolved_at, resolved_by, resolution_note")
    .order("status", { ascending: true }) // open first
    .order("created_at", { ascending: false });

  if (status === "open" || status === "resolved") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    console.error("[admin/debug/reports] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reports: data ?? [] });
}

/** POST: MVP 에러 제보 올리기 (admin only when BTY_ADMIN_EMAILS set, 입력 검증 적용) */
export async function POST(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  let body: { title: string; description?: string; context?: Record<string, unknown>; route?: "chat" | "mentor" | "arena" | "other" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (title.length > TITLE_MAX) return NextResponse.json({ error: `title max ${TITLE_MAX} chars` }, { status: 400 });

  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  if (description !== null && description.length > DESCRIPTION_MAX) {
    return NextResponse.json({ error: `description max ${DESCRIPTION_MAX} chars` }, { status: 400 });
  }

  let context: Record<string, unknown> = {};
  if (body.context && typeof body.context === "object" && !Array.isArray(body.context)) {
    const keys = Object.keys(body.context);
    if (keys.length > CONTEXT_KEYS_MAX) {
      return NextResponse.json({ error: `context max ${CONTEXT_KEYS_MAX} keys` }, { status: 400 });
    }
    context = body.context as Record<string, unknown>;
    try {
      if (JSON.stringify(context).length > CONTEXT_JSON_MAX) {
        return NextResponse.json({ error: `context max ${CONTEXT_JSON_MAX} bytes` }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "context too large" }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("mvp_debug_reports")
    .insert({
      title,
      description,
      context,
      route: (body.route && ["chat", "mentor", "arena", "other"].includes(body.route) ? body.route : "other") as string,
      created_by: auth.user.id,
    })
    .select("id, title, status, created_at")
    .single();

  if (error) {
    console.error("[admin/debug/reports] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
