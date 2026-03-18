"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

/** Inline icons (lucide-free). */
function IconArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconRotateCcw({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-7.7L3 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconShieldAlert({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
    </svg>
  );
}

export type JourneyDayState = "completed" | "current" | "upcoming";

export type JourneyGrowthDay = {
  day: number;
  state: JourneyDayState;
};

export type JourneyGrowthBoardShellProps = {
  currentDay?: number;
  totalDays?: number;
  onContinue?: (day: number) => void;
  onRestart?: () => void;
  onBack?: () => void;
  statusText?: string;
  showRestart?: boolean;
};

/**
 * Growth Journey board shell (Recovery Loop grid + actions).
 * Port of shadcn prototype without @/components/ui/card|dialog|lucide.
 */
export function JourneyGrowthBoardShell({
  currentDay = 8,
  totalDays = 28,
  onContinue,
  onRestart,
  onBack,
  statusText = "Recovery sequence active.",
  showRestart = true,
}: JourneyGrowthBoardShellProps) {
  const days = useMemo<JourneyGrowthDay[]>(() => {
    return Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      let state: JourneyDayState = "upcoming";
      if (day < currentDay) state = "completed";
      if (day === currentDay) state = "current";
      return { day, state };
    });
  }, [currentDay, totalDays]);

  return (
    <div className="min-h-screen bg-[#F6F4EE] px-4 py-6 text-[#1F2937]">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#E8E3D8] bg-white px-3 py-2 text-sm text-[#405A74] shadow-sm"
          >
            <IconArrowLeft className="h-4 w-4" />
            Back
          </button>
          <span className="rounded-full bg-[#1E2A38] px-3 py-1 text-xs font-medium text-white">Journey</span>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#667085]">Recovery Loop</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1E2A38]">Day {currentDay}</h1>
          <p className="text-sm leading-6 text-[#667085]">{statusText}</p>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-[#E8E3D8] bg-white shadow-sm">
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1E2A38]">Current Path</p>
                <p className="mt-1 text-xs text-[#667085]">Progress continues from your current path.</p>
              </div>
              <div className="rounded-2xl bg-[#F1EEE6] px-3 py-2 text-right">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#667085]">Current Day</p>
                <p className="text-lg font-semibold text-[#1E2A38]">{currentDay}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
              {days.map((item) => (
                <div
                  key={item.day}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-2xl border text-center transition-all",
                    item.state === "completed" && "border-[#D8D0C0] bg-[#F1EEE6] text-[#4D6B57]",
                    item.state === "current" &&
                      "border-[#B08D57] bg-[#FFF8EE] text-[#1E2A38] shadow-sm ring-1 ring-[#E5C68B]",
                    item.state === "upcoming" && "border-[#ECE7DC] bg-white text-[#98A2B3]"
                  )}
                >
                  <span className="text-[10px] uppercase tracking-[0.12em]">Day</span>
                  <span className="mt-1 text-sm font-semibold">{String(item.day).padStart(2, "0")}</span>
                  <span className="mt-1 text-xs">
                    {item.state === "completed" ? "✓" : item.state === "current" ? "●" : "·"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#E8E3D8] bg-white shadow-sm">
          <div className="space-y-4 p-5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#1E2A38]">System Note</p>
              <p className="text-sm leading-6 text-[#667085]">
                Sequence remains open. Continue from the current path when ready.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onContinue?.(currentDay)}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#1E2A38] text-sm font-medium text-white hover:bg-[#243446]"
              >
                Continue Day {currentDay}
              </button>

              {showRestart ? (
                <button
                  type="button"
                  onClick={onRestart}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#D7CFBF] bg-transparent text-sm font-medium text-[#405A74] hover:bg-[#F6F4EE]"
                >
                  <IconRotateCcw className="h-4 w-4" />
                  Restart Journey
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type ComebackGrowthModalProps = {
  open: boolean;
  onResume: () => void;
  onClose: () => void;
};

export function ComebackGrowthModal({ open, onResume, onClose }: ComebackGrowthModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel="System detected interruption."
      className="max-w-md border-[#E8E3D8] bg-[#FFFCF7] p-0"
    >
      <div className="p-6">
        <div className="mb-4 inline-flex rounded-2xl bg-[#F1EEE6] p-3 text-[#A06A3A]">
          <IconShieldAlert className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#1E2A38]">
          System detected interruption.
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#667085]">Resume your Journey from the current path.</p>

        <div className="mt-5 rounded-2xl border border-[#E8E3D8] bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#667085]">Recovery Note</p>
          <p className="mt-2 text-sm leading-6 text-[#405A74]">
            Recovery sequence is available. No reset is required unless you choose to restart manually.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-[#EEE7DA] bg-white px-6 py-5">
        <button
          type="button"
          onClick={onResume}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#1E2A38] text-sm font-medium text-white hover:bg-[#243446]"
        >
          Resume Journey
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#D7CFBF] bg-transparent text-sm font-medium text-[#405A74] hover:bg-[#F6F4EE]"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

export type JourneyGrowthRestartConfirmProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function JourneyGrowthRestartConfirmModal({
  open,
  onConfirm,
  onCancel,
}: JourneyGrowthRestartConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      ariaLabel="Restart Journey?"
      className="max-w-sm border-[#E8E3D8] bg-white p-0"
    >
      <div className="p-6">
        <h2 className="text-xl font-semibold text-[#1E2A38]">Restart Journey?</h2>
        <p className="mt-2 text-sm leading-6 text-[#667085]">
          This will begin the sequence from Day 1. Restart is optional and not required for recovery.
        </p>
      </div>
      <div className="flex flex-col gap-3 border-t border-[#EEE7DA] px-6 py-5">
        <button
          type="button"
          onClick={onConfirm}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#1E2A38] text-sm font-medium text-white hover:bg-[#243446]"
        >
          Restart
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#D7CFBF] bg-transparent text-sm font-medium text-[#405A74] hover:bg-[#F6F4EE]"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/** Demo composition: comeback + board + restart confirm (local state only). */
export function JourneyGrowthShellDemo() {
  const [modalOpen, setModalOpen] = useState(true);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [currentDay, setCurrentDay] = useState(8);

  return (
    <div className="min-h-screen bg-[#EEE9DF]">
      <ComebackGrowthModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onResume={() => setModalOpen(false)}
      />
      <JourneyGrowthBoardShell
        currentDay={currentDay}
        onContinue={() => {}}
        onRestart={() => setShowRestartConfirm(true)}
        onBack={() => {}}
      />
      <JourneyGrowthRestartConfirmModal
        open={showRestartConfirm}
        onConfirm={() => {
          setCurrentDay(1);
          setShowRestartConfirm(false);
        }}
        onCancel={() => setShowRestartConfirm(false)}
      />
    </div>
  );
}
