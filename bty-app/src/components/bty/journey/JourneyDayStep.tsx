"use client";

type JourneyDayStepProps = {
  day: number;
  title: string;
  body: string;
  onComplete: () => void;
  onBack: () => void;
  submitting?: boolean;
  completeDisabled?: boolean;
  lockMessage?: string;
};

export default function JourneyDayStep({
  day,
  title,
  body,
  onComplete,
  onBack,
  submitting = false,
  completeDisabled = false,
  lockMessage,
}: JourneyDayStepProps) {
  const disabled = submitting || completeDisabled;

  return (
    <div className="min-h-screen bg-[#F6F4EE] px-4 py-6 pb-28 text-[#1F2937]">
      <div className="mx-auto max-w-md space-y-5">
        <button
          type="button"
          onClick={onBack}
          className="rounded-2xl border border-[#E8E3D8] bg-white px-3 py-2 text-sm text-[#405A74] shadow-sm"
        >
          Back to Journey
        </button>

        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#667085]">
            Journey / Day {day}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1E2A38] sm:text-3xl">{title}</h1>
          <p className="whitespace-pre-line text-sm leading-6 text-[#667085]">{body}</p>
        </div>

        <div className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">System Note</p>
          <p className="mt-2 text-sm leading-6 text-[#667085]">
            Complete the current step when ready. Recovery proceeds one day at a time.
          </p>

          {lockMessage ? (
            <p className="mt-4 rounded-2xl border border-[#E8E3D8] bg-[#F1EEE6] px-4 py-3 text-sm text-[#405A74]">
              {lockMessage}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={onComplete}
              disabled={disabled}
              className="h-12 w-full rounded-2xl bg-[#1E2A38] px-4 text-sm font-medium text-white hover:bg-[#243446] disabled:opacity-60"
            >
              {submitting ? "Completing…" : `Complete Day ${day}`}
            </button>

            <button
              type="button"
              onClick={onBack}
              className="h-12 w-full rounded-2xl border border-[#D7CFBF] bg-transparent px-4 text-sm font-medium text-[#405A74] hover:bg-[#F6F4EE]"
            >
              Back to Journey
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
