"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";

function computeLevelTier(xpTotal: number) {
  const safe = Math.max(0, Math.floor(xpTotal || 0));
  const level = Math.floor(safe / 100) + 1;

  let tier: "Bronze" | "Silver" | "Gold" | "Platinum" = "Bronze";
  if (safe >= 300) tier = "Platinum";
  else if (safe >= 200) tier = "Gold";
  else if (safe >= 100) tier = "Silver";

  const progressPct = safe % 100; // 0~99
  return { level, tier, progressPct };
}

type WeeklyXp = { xpTotal?: number };

export default function DashboardPage() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" ? params.locale : "en") as "en" | "ko";

  const [weekly, setWeekly] = useState<WeeklyXp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/arena/weekly-xp", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: WeeklyXp) => {
        if (!cancelled) setWeekly(data);
      })
      .catch(() => {
        if (!cancelled) setWeekly({ xpTotal: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const xpTotal = weekly?.xpTotal ?? 0;
  const { level, tier, progressPct } = computeLevelTier(xpTotal);

  return (
    <AuthGate>
      <main className="min-h-screen bg-[#f5f5f7]">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
          <Nav locale={locale} pathname={`/${locale}/bty/dashboard`} />
          <header className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f]">Arena Dashboard</h1>
            <p className="text-[#86868b] mt-1 text-sm">Competition XP & progress</p>
          </header>

          {loading ? (
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-8 text-center text-[#86868b]">
              Loading…
            </div>
          ) : (
            <div
              className="rounded-2xl border border-[#e5e5e5] bg-white p-6 sm:p-8"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
            >
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>COMPETITION XP</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{xpTotal}</div>

              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    <b>Level</b> {level}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    <b>Tier</b> {tier}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    <b>Progress</b> {progressPct}%
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    height: 10,
                    borderRadius: 999,
                    border: "1px solid #eee",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${progressPct}%`,
                      background: "#111",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <footer className="mt-8 pt-4 border-t border-[#e5e5e5] text-center text-sm text-[#86868b]">
            <Link href="/bty/mentor" className="text-[#0071e3] hover:underline">
              Mentor
            </Link>
            <span className="mx-2">·</span>
            <Link href="/bty/arena" className="text-[#0071e3] hover:underline">
              Arena
            </Link>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
