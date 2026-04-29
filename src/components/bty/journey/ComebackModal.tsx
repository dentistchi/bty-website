"use client";

import { Modal } from "@/components/ui/Modal";

type ComebackModalProps = {
  open: boolean;
  onResume: () => void;
  onClose: () => void;
};

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
    </svg>
  );
}

export default function ComebackModal({ open, onResume, onClose }: ComebackModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel="System detected interruption."
      panelDataTestId="comeback-modal"
      className="max-w-md border-[#E8E3D8] bg-[#FFFCF7] p-0 shadow-xl"
    >
      <div className="p-6">
        <div className="mb-4 inline-flex rounded-2xl bg-[#F1EEE6] p-3 text-[#A06A3A]">
          <IconShield className="h-5 w-5" />
        </div>
        <h2
          data-testid="comeback-modal-title"
          className="text-2xl font-semibold tracking-tight text-[#1E2A38]"
        >
          System detected interruption.
        </h2>
        <p data-testid="comeback-modal-description" className="mt-3 text-sm leading-6 text-[#667085]">
          Resume your Journey from the current path.
        </p>

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
          data-testid="resume-journey-button"
          onClick={onResume}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#1E2A38] text-sm font-medium text-white hover:bg-[#243446]"
        >
          Resume Journey
        </button>
        <button
          type="button"
          data-testid="close-comeback-button"
          onClick={onClose}
          className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#D7CFBF] bg-transparent text-sm font-medium text-[#405A74] hover:bg-[#F6F4EE]"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
