#!/usr/bin/env node
/**
 * CI: E2E comeback 계정의 bty_profiles를 "3일+ 미접촉" 상태로 맞춰 ComebackModal이 뜨게 함.
 * JourneyClient는 sessionStorage ack 없이 is_comeback_eligible 일 때만 모달을 연다.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_COMEBACK_EMAIL
 * Optional: E2E_COMEBACK_JOURNEY_DAY (default 8, 1–28)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = process.env.E2E_COMEBACK_EMAIL?.trim();
const day = Math.min(28, Math.max(1, Number(process.env.E2E_COMEBACK_JOURNEY_DAY) || 8));

if (!url || !serviceKey) {
  console.error("[e2e-seed-comeback] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!email) {
  console.error("[e2e-seed-comeback] Missing E2E_COMEBACK_EMAIL");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** 5일 전 — profile 라우트의 3일 eligibility와 여유 */
const stale = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

let user = null;
for (let page = 1; page <= 20 && !user; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("[e2e-seed-comeback] listUsers:", error.message);
    process.exit(1);
  }
  user = data.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
  if (data.users.length < 200) break;
}

if (!user) {
  console.error(`[e2e-seed-comeback] No auth user with email: ${email}`);
  process.exit(1);
}

const row = {
  user_id: user.id,
  current_day: day,
  season: 1,
  started_at: stale,
  updated_at: stale,
  last_completed_at: stale,
  bounce_back_count: 0,
};

const { error: upsertError } = await supabase.from("bty_profiles").upsert(row, {
  onConflict: "user_id",
});

if (upsertError) {
  console.error("[e2e-seed-comeback] upsert bty_profiles:", upsertError.message);
  process.exit(1);
}

console.log(`[e2e-seed-comeback] OK user_id=${user.id} current_day=${day} (stale timestamps for modal)`);
