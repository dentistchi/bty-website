"use client";

import { Modal } from "@/components/ui/Modal";

type RestartJourneyDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function RestartJourneyDialog({ open, onConfirm, onClose }: RestartJourneyDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel="Restart Journey?"
      panelDataTestId="restart-journey-dialog"
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
          data-testid="restart-journey-confirm"
          onClick={onConfirm}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#1E2A38] text-sm font-medium text-white hover:bg-[#243446]"
        >
          Restart
        </button>
        <button
          type="button"
          data-testid="restart-journey-cancel"
          onClick={onClose}
          className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#D7CFBF] bg-transparent text-sm font-medium text-[#405A74] hover:bg-[#F6F4EE]"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
