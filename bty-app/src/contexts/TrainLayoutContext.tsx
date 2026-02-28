"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { PageLoadingFallback } from "@/components/bty-arena";

export type Progress = {
  startDateISO: string;
  lastCompletedDay: number;
  lastCompletedAt: string | null;
  completedDays?: number[];
};

type TrainLayoutContextValue = {
  progress: Progress | null;
  refreshProgress: () => Promise<void>;
  onMarkCompleteSuccess?: () => void;
  startDateISO: string | null;
  completedDays: number[];
  lastCompletedDay: number;
};

const TrainLayoutContext = createContext<TrainLayoutContextValue | null>(null);

export function useTrainLayout() {
  const ctx = useContext(TrainLayoutContext);
  return ctx;
}

export function TrainLayoutProvider({
  progress,
  refreshProgress,
  onMarkCompleteSuccess,
  children,
}: {
  progress: Progress | null;
  refreshProgress: () => Promise<void>;
  onMarkCompleteSuccess?: () => void;
  children: ReactNode;
}) {
  const value = React.useMemo(
    () => ({
      progress,
      refreshProgress,
      onMarkCompleteSuccess,
      startDateISO: progress?.startDateISO ?? null,
      completedDays: progress?.completedDays ?? [],
      lastCompletedDay: progress?.lastCompletedDay ?? 0,
    }),
    [
      progress,
      refreshProgress,
      onMarkCompleteSuccess,
      progress?.startDateISO,
      progress?.lastCompletedDay,
      progress?.completedDays?.join(","),
    ]
  );

  if (!progress) {
    return <PageLoadingFallback />;
  }

  return (
    <TrainLayoutContext.Provider value={value}>
      {children}
    </TrainLayoutContext.Provider>
  );
}
