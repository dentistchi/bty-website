/** Emitted when user confirms return to Arena after Foundry program completion ({@link ProgramProgressShell}). */
export const FOUNDRY_EXIT_READY_EVENT = "foundry_exit_ready" as const;

export type FoundryExitReadyDetail = {
  programId: string;
  userId: string;
};
