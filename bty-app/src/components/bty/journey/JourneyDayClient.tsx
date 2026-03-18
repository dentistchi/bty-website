"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/bty/navigation/BottomNav";
import JourneyDayStep from "@/components/bty/journey/JourneyDayStep";
import { getJourneyProfile } from "@/lib/bty/journey/api";
import {
  completeJourneyDay,
  getJourneyDay,
  getDayAccess,
  type JourneyDayContent,
} from "@/lib/bty/journey/day-api";

type JourneyDayClientProps = {
  locale: string;
  day: number;
};

export default function JourneyDayClient({ locale, day }: JourneyDayClientProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const loc = locale === "ko" ? "ko" : "en";

  const [content, setContent] = useState<JourneyDayContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  const [lastCompletedAt, setLastCompletedAt] = useState<string | null>(null);

  const dayNum = Number.isFinite(day) ? Math.min(28, Math.max(1, Math.floor(day))) : 1;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [profile, dayContent] = await Promise.all([
        getJourneyProfile(),
        getJourneyDay(dayNum, loc),
      ]);
      setCurrentDay(profile.current_day);
      setLastCompletedAt(profile.last_completed_at ?? null);
      setContent(dayContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load journey day");
      setContent(null);
    } finally {
      setLoading(false);
    }
  }, [user, dayNum, loc]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void load();
  }, [authLoading, user, load]);

  const handleBack = useCallback(() => {
    router.push(`/${loc}/growth/journey`);
  }, [router, loc]);

  const handleComplete = useCallback(async () => {
    if (!content) return;
    try {
      setSubmitting(true);
      setError(null);
      await completeJourneyDay(content.day);
      router.push(`/${loc}/growth/journey`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete journey day");
    } finally {
      setSubmitting(false);
    }
  }, [content, router, loc]);

  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] px-4 py-10 pb-24 text-center text-sm text-[#667085]">
        Loading…
        <BottomNav locale={locale} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] px-4 py-10 pb-24">
        <div className="mx-auto max-w-md rounded-3xl border border-[#E8E3D8] bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">Sign in to continue</p>
          <Link
            href={`/${loc}/bty/login`}
            className="mt-4 inline-block rounded-2xl bg-[#1E2A38] px-6 py-3 text-sm font-medium text-white hover:bg-[#243446]"
          >
            Log in
          </Link>
        </div>
        <BottomNav locale={locale} />
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] px-4 py-10 pb-24 text-center">
        <div className="mx-auto max-w-md rounded-3xl border border-[#E8E3D8] bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">Journey day unavailable</p>
          <p className="mt-2 text-sm leading-6 text-[#667085]">{error}</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-4 rounded-2xl border border-[#D7CFBF] px-4 py-2 text-sm text-[#405A74]"
          >
            Back to Journey
          </button>
        </div>
        <BottomNav locale={locale} />
      </div>
    );
  }

  if (!content || currentDay === null) {
    return null;
  }

  const access = getDayAccess(content.day, currentDay, lastCompletedAt, loc);

  if (access.kind === "future") {
    return (
      <div className="min-h-screen bg-[#F6F4EE] px-4 py-10 pb-24">
        <div className="mx-auto max-w-md rounded-3xl border border-[#E8E3D8] bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">Not yet available</p>
          <p className="mt-2 text-sm text-[#667085]">Continue from your current day on the Journey hub.</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-4 rounded-2xl bg-[#1E2A38] px-6 py-3 text-sm font-medium text-white hover:bg-[#243446]"
          >
            Back to Journey
          </button>
        </div>
        <BottomNav locale={locale} />
      </div>
    );
  }

  if (access.kind === "past") {
    return (
      <div className="min-h-screen bg-[#F6F4EE] px-4 py-10 pb-24">
        <div className="mx-auto max-w-md rounded-3xl border border-[#E8E3D8] bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">This day is behind you</p>
          <p className="mt-2 text-sm text-[#667085]">Your path continues from the Journey hub.</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-4 rounded-2xl bg-[#1E2A38] px-6 py-3 text-sm font-medium text-white hover:bg-[#243446]"
          >
            Back to Journey
          </button>
        </div>
        <BottomNav locale={locale} />
      </div>
    );
  }

  const locked = access.kind === "locked";
  const lockMessage = locked ? access.message : undefined;

  return (
    <div className="min-h-screen bg-[#F6F4EE]">
      {error ? (
        <div className="mx-auto max-w-md px-4 py-2 text-center text-xs text-amber-800 bg-amber-50 border-b border-amber-100">
          {error}
        </div>
      ) : null}
      <JourneyDayStep
        day={content.day}
        title={content.title}
        body={content.body}
        onComplete={() => void handleComplete()}
        onBack={handleBack}
        submitting={submitting}
        completeDisabled={locked}
        lockMessage={lockMessage}
      />
      <BottomNav locale={locale} />
    </div>
  );
}
