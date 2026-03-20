import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type GlassPanelProps = {
  children: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children">;

export default function GlassPanel({ children, className, ...rest }: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-[2rem] border border-white/10 bg-white/[0.05] shadow-2xl backdrop-blur-xl",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
