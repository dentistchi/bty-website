import { GlassPanel } from "./GlassPanel";

type Props = {
  label: string;
  value: string;
  "data-testid"?: string;
};

export function SummaryCard({ label, value, "data-testid": testId }: Props) {
  return (
    <GlassPanel data-testid={testId} className="p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">{label}</div>
      <div className="mt-3 text-base font-semibold leading-7 text-white sm:text-lg">{value}</div>
    </GlassPanel>
  );
}
