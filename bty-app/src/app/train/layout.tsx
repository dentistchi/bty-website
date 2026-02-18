import type { ReactNode } from "react";
import TrainShell from "@/components/train/TrainShell";

export default function TrainLayout({ children }: { children: ReactNode }) {
  return <TrainShell>{children}</TrainShell>;
}
