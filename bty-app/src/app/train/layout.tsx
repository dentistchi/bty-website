import type { ReactNode } from "react";
import TrainShell from "@/components/train/TrainShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TrainLayout({ children }: { children: ReactNode }) {
  return <TrainShell>{children}</TrainShell>;
}
