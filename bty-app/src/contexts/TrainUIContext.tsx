"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type CompletionPayload = {
  day: number;
  title: string;
  summary: string[];
  questions: string[];
};

export type RightPanelTab = "chat" | "completion";

type TrainUIContextValue = {
  tab: RightPanelTab;
  completion: CompletionPayload | null;
  packLoading: boolean;
  setTab: (t: RightPanelTab) => void;
  openCompletionPanel: (payload: CompletionPayload) => void;
  openChatPanel: () => void;
  clearCompletion: () => void;
  setPackLoading: (loading: boolean) => void;
};

const TrainUIContext = createContext<TrainUIContextValue | null>(null);

export function useTrainUI() {
  const ctx = useContext(TrainUIContext);
  if (!ctx) throw new Error("useTrainUI must be used within TrainUIProvider");
  return ctx;
}

export function TrainUIProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<RightPanelTab>("chat");
  const [completion, setCompletion] = useState<CompletionPayload | null>(null);
  const [packLoading, setPackLoading] = useState(false);

  const openCompletionPanel = useCallback((payload: CompletionPayload) => {
    setCompletion(payload);
    setTab("completion");
  }, []);

  const openChatPanel = useCallback(() => setTab("chat"), []);
  const clearCompletion = useCallback(() => setCompletion(null), []);

  const value = useMemo<TrainUIContextValue>(
    () => ({
      tab,
      completion,
      packLoading,
      setTab,
      openCompletionPanel,
      openChatPanel,
      clearCompletion,
      setPackLoading,
    }),
    [tab, completion, packLoading, openCompletionPanel, openChatPanel, clearCompletion]
  );

  return <TrainUIContext.Provider value={value}>{children}</TrainUIContext.Provider>;
}
