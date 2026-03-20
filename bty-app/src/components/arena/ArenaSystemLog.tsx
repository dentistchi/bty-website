import { cn } from "@/lib/utils";

export type ArenaSystemLogProps = {
  message: string;
  testId?: string;
};

export default function ArenaSystemLog({ message, testId = "arena-system-log" }: ArenaSystemLogProps) {
  return (
    <div
      data-testid={testId}
      className={cn("rounded-2xl border border-cyan-300/10 bg-slate-950/80 px-4 py-3 backdrop-blur-xl")}
    >
      <p className="text-sm tracking-[0.16em] text-cyan-100/85 transition-opacity duration-300">{message}</p>
    </div>
  );
}
