"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import ComebackModal from "@/components/bty/journey/ComebackModal";
import JourneyBoard from "@/components/bty/journey/JourneyBoard";
import RestartJourneyDialog from "@/components/bty/journey/RestartJourneyDialog";
import {
  getJourneyProfile,
  recordBounceBack,
  restartJourneyFromDayOne,
  type JourneyProfile,
} from "@/lib/bty/journey/api";

const SESSION_ACK = "bty_journey_comeback_ack";

type JourneyClientProps = {
  locale: string;
};

export default function JourneyClient({ locale }: JourneyClientProps) {
  const router = useRouter();
  const loc = locale === "ko" ? "ko" : "en";
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<JourneyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comebackOpen, setComebackOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getJourneyProfile();
      setProfile(data);
      const ack =
        typeof window !== "undefined" ? sessionStorage.getItem(SESSION_ACK) : null;
      const eligible = Boolean(data.is_comeback_eligible) && ack !== "1";
      setComebackOpen(eligible);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load journey");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setProfile(null);
      return;
    }
    void loadProfile();
  }, [authLoading, user, loadProfile]);

  const acknowledgeComebackSession = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_ACK, "1");
    } catch {
      /* ignore */
    }
    setComebackOpen(false);
  }, []);

  const handleResumeJourney = useCallback(async () => {
    try {
      await recordBounceBack();
      acknowledgeComebackSession();
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record bounce-back");
    }
  }, [acknowledgeComebackSession, loadProfile]);

  const handleCloseComeback = useCallback(() => {
    acknowledgeComebackSession();
  }, [acknowledgeComebackSession]);

  const handleRestartConfirm = useCallback(async () => {
    if (!profile) return;
    try {
      await restartJourneyFromDayOne(profile.season ?? 1);
      setRestartOpen(false);
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restart");
    }
  }, [profile, loadProfile]);

  if (authLoading || (user && loading)) {
    return (
      <ScreenShell locale={locale} showBottomNav>
        <p className="py-12 text-center text-sm text-[#667085]">Loading Journey…</p>
      </ScreenShell>
    );
  }

  if (!user) {
    return (
      <ScreenShell locale={locale} showBottomNav>
        <div className="mx-auto max-w-md rounded-3xl border border-[#E8E3D8] bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">Sign in to continue</p>
          <Link
            href={`/${loc}/bty/login`}
            className="mt-4 inline-block rounded-2xl bg-[#1E2A38] px-6 py-3 text-sm font-medium text-white hover:bg-[#243446]"
          >
            Log in
          </Link>
        </div>
      </ScreenShell>
    );
  }

  if (error && !profile) {
    return (
      <ScreenShell locale={locale} showBottomNav>
        <div className="mx-auto max-w-md rounded-3xl border border-[#E8E3D8] bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">Journey unavailable</p>
          <p className="mt-2 text-sm leading-6 text-[#667085]">{error}</p>
          <button
            type="button"
            onClick={() => void loadProfile()}
            className="mt-4 rounded-2xl border border-[#D7CFBF] px-4 py-2 text-sm text-[#405A74] hover:bg-[#F6F4EE]"
          >
            Retry
          </button>
        </div>
      </ScreenShell>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <ScreenShell locale={locale} showBottomNav fullWidth contentClassName="pb-24">
      <div className="mx-auto max-w-md px-4">
        {error ? (
          <div className="mb-2 text-center text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl py-2 px-3">
            {error}
          </div>
        ) : null}

        <ComebackModal
          open={comebackOpen}
          onResume={() => void handleResumeJourney()}
          onClose={handleCloseComeback}
        />

        <JourneyBoard
          locale={loc}
          currentDay={profile.current_day}
          totalDays={profile.total_days ?? 28}
          statusText="Recovery sequence active."
          onContinue={(day) => router.push(`/${loc}/growth/journey/day/${day}`)}
          onRestart={() => setRestartOpen(true)}
        />

        <RestartJourneyDialog
          open={restartOpen}
          onConfirm={() => void handleRestartConfirm()}
          onClose={() => setRestartOpen(false)}
        />
      </div>
    </ScreenShell>
  );
}
