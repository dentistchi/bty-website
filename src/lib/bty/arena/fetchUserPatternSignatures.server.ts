import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserPatternSignaturePublic } from "@/lib/bty/arena/patternSignature.types";

export async function fetchUserPatternSignaturesForMyPage(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true; rows: UserPatternSignaturePublic[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("user_pattern_signatures")
    .select(
      "pattern_family, axis, current_state, repeat_count, last_validation_result, confidence_score, next_watchpoint, last_seen_at, first_seen_at",
    )
    .eq("user_id", userId)
    .in("current_state", ["active", "unstable"])
    .order("last_seen_at", { ascending: false })
    .limit(24);

  if (error) return { ok: false, message: error.message };

  const rows: UserPatternSignaturePublic[] = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      pattern_family: String(row.pattern_family ?? ""),
      axis: String(row.axis ?? ""),
      current_state: row.current_state as UserPatternSignaturePublic["current_state"],
      repeat_count: Number(row.repeat_count ?? 0),
      last_validation_result: row.last_validation_result as UserPatternSignaturePublic["last_validation_result"],
      confidence_score: Number(row.confidence_score ?? 0),
      next_watchpoint: typeof row.next_watchpoint === "string" ? row.next_watchpoint : null,
      last_seen_at: String(row.last_seen_at ?? ""),
      first_seen_at: String(row.first_seen_at ?? ""),
    };
  });

  return { ok: true, rows };
}
