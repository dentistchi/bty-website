"use client";

import React from "react";
import { TrainUIProvider } from "@/contexts/TrainUIContext";
import TrainShell from "@/components/train/TrainShell";

export default function TrainLayout({ children }: { children: React.ReactNode }) {
  return (
    <TrainUIProvider>
      <TrainShell>{children}</TrainShell>
    </TrainUIProvider>
  );
}
