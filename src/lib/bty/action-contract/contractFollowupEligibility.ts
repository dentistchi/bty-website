export type ContractFollowupTrigger = "new_session" | "after_24h" | "before_next_chain";

const MS_24H = 24 * 60 * 60 * 1000;

/**
 * When to surface the action-contract follow-up (OR semantics).
 * - New session: current arena session id differs from the contract's session.
 * - After 24h: at least 24 hours since commit.
 * - Before next chain: opt-in from chain runner (caller passes `beforeNextChain: true`).
 */
export function resolveContractFollowupTrigger(opts: {
  contractSessionId: string;
  currentSessionId: string | null;
  committedAtIso: string;
  nowMs: number;
  /** Set by chain workspace script when starting a chain. */
  beforeNextChain?: boolean;
}): ContractFollowupTrigger | null {
  const committedMs = Date.parse(opts.committedAtIso);
  if (Number.isNaN(committedMs)) return null;

  if (opts.beforeNextChain) return "before_next_chain";
  if (opts.nowMs - committedMs >= MS_24H) return "after_24h";
  if (
    opts.currentSessionId !== null &&
    opts.currentSessionId !== "" &&
    opts.contractSessionId !== opts.currentSessionId
  ) {
    return "new_session";
  }
  return null;
}
