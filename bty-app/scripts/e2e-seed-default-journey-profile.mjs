#!/usr/bin/env node
/**
 * CI: E2E 기본 계정(E2E_EMAIL)의 bty_profiles.updated_at을 최신으로 맞춰
 * GET /api/journey/profile 의 is_comeback_eligible 이 false가 되게 함 (ComebackModal 미표시).
 *
 * 규칙: now - touchMs < 3d 이면 비자격 (touchMs = updated_at ?? progressMs).
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_EMAIL
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = process.env.E2E_EMAIL?.trim();

if (!url || !serviceKey) {
  console.error("[e2e-seed-default-journey] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!email) {
  console.error("[e2e-seed-default-journey] Missing E2E_EMAIL");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let user = null;
for (let page = 1; page <= 20 && !user; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("[e2e-seed-default-journey] listUsers:", error.message);
    process.exit(1);
  }
  user = data.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
  if (data.users.length < 200) break;
}

if (!user) {
  console.error(`[e2e-seed-default-journey] No auth user with email: ${email}`);
  process.exit(1);
}

const nowIso = new Date().toISOString();

const { data: existing, error: selErr } = await supabase
  .from("bty_profiles")
  .select("*")
  .eq("user_id", user.id)
  .maybeSingle();

if (selErr && selErr.code !== "PGRST116") {
  console.error("[e2e-seed-default-journey] select bty_profiles:", selErr.message);
  process.exit(1);
}

const row = {
  user_id: user.id,
  current_day: Math.min(28, Math.max(1, Number(existing?.current_day) || 1)),
  season: Math.max(1, Number(existing?.season) || 1),
  started_at: typeof existing?.started_at === "string" ? existing.started_at : nowIso,
  updated_at: nowIso,
  last_completed_at:
    existing?.last_completed_at === null || existing?.last_completed_at === undefined
      ? null
      : typeof existing.last_completed_at === "string"
        ? existing.last_completed_at
        : null,
  bounce_back_count: typeof existing?.bounce_back_count === "number" ? existing.bounce_back_count : 0,
};

const { error: upsertError } = await supabase.from("bty_profiles").upsert(row, {
  onConflict: "user_id",
});

if (upsertError) {
  console.error("[e2e-seed-default-journey] upsert bty_profiles:", upsertError.message);
  process.exit(1);
}

console.log(
  `[e2e-seed-default-journey] OK user_id=${user.id} current_day=${row.current_day} updated_at=fresh (no comeback modal)`,
);
