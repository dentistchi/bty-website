"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";

type Progress = {
  startDateISO: string;
  lastCompletedDay: number;
  lastCompletedAt: string | null;
};

type TrainLayoutContextValue = {
  progress: Progress | null;
  refreshProgress: () => Promise<void>;
  onMarkCompleteSuccess: () => void;
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
  onMarkCompleteSuccess: () => void;
  children: ReactNode;
}) {
  const value: TrainLayoutContextValue = {
    progress,
    refreshProgress,
    onMarkCompleteSuccess,
  };
  return (
    <TrainLayoutContext.Provider value={value}>
      {children}
    </TrainLayoutContext.Provider>
  );
}
