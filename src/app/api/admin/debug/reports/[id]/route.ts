import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireAdminEmail } from "@/lib/authz";

export const runtime = "nodejs";

const RESOLUTION_NOTE_MAX = 2000;

/** PATCH: 교정 완료 (admin only when BTY_ADMIN_EMAILS set) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  let body: { status?: "resolved"; resolution_note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let resolutionNote: string | null = null;
  if (typeof body.resolution_note === "string") {
    const trimmed = body.resolution_note.trim();
    if (trimmed.length > RESOLUTION_NOTE_MAX) {
      return NextResponse.json({ error: `resolution_note max ${RESOLUTION_NOTE_MAX} chars` }, { status: 400 });
    }
    resolutionNote = trimmed || null;
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status === "resolved") {
    updates.status = "resolved";
    updates.resolved_at = new Date().toISOString();
    updates.resolved_by = auth.user.id;
    if (resolutionNote !== null) updates.resolution_note = resolutionNote;
  }
  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("mvp_debug_reports")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[admin/debug/reports] PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
