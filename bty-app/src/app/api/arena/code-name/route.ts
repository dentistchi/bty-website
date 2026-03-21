import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { arenaCodeNameFromUnknown } from "@/domain/arena/scenarios";

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { codeName?: unknown };
  const codeNameInput = String(body?.codeName ?? "");
  const validated = arenaCodeNameFromUnknown(codeNameInput);
  if (!validated.ok) {
    return NextResponse.json(
      { error: "INVALID_CODE_NAME", reason: validated.reason },
      { status: 400 }
    );
  }

  const { data: prof, error: profErr } = await supabase
    .from("arena_profiles")
    .select("user_id, core_xp_total, code_hidden, code_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json(
      { error: "PROFILE_READ_FAILED", detail: profErr.message },
      { status: 500 }
    );
  }

  const row = prof as { core_xp_total?: number; code_hidden?: boolean; code_name?: string | null } | null;
  const coreXpTotal = Number(row?.core_xp_total ?? 0);
  const alreadyHidden = Boolean(row?.code_hidden);

  if (alreadyHidden || coreXpTotal >= 700) {
    const { error: upErr } = await supabase
      .from("arena_profiles")
      .upsert(
        { user_id: user.id, code_hidden: true, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (upErr) {
      return NextResponse.json(
        { error: "PROFILE_UPDATE_FAILED", detail: upErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: "CODE_NAME_LOCKED",
        codeHidden: true,
        message: "Code Name is hidden/locked in 700+ zone.",
      },
      { status: 403 }
    );
  }

  const { error: upsertErr } = await supabase
    .from("arena_profiles")
    .upsert(
      {
        user_id: user.id,
        code_name: validated.value,
        code_hidden: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (upsertErr) {
    return NextResponse.json(
      { error: "PROFILE_UPSERT_FAILED", detail: upsertErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, codeName: validated.value, codeHidden: false });
}
