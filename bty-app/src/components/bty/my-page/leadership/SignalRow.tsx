type Props = {
  label: string;
  value: string;
  valueTestId?: string;
};

/** Quiet row: label + interpreted state (no raw numbers). */
export function SignalRow({ label, value, valueTestId }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span
        data-testid={valueTestId}
        className="text-right text-sm font-medium text-white"
      >
        {value}
      </span>
    </div>
  );
}
