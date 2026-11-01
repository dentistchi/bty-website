/**
 * Deterministic service-transport fixture, not a PostgreSQL transaction/race proof.
 * The independent foundry-xp-postgres-qa harness executes the actual migration.
 * Keep this model's fixed +10 / three-per-day oracle independent of production helpers.
 */
type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
export const fixtureUuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

export function simulateFoundryCoreAtomic(tables: Tables, p: Row, onAward?: (award: Row) => void) {
  const result = (data: Row) => ({ data, error: null });
  const fail = (message: string) => ({ data: null, error: { message } });
  const nonpaid = (outcome: string) => result({ policyVersion: "foundry-core-atomic/v1", outcome });
  const progress = (tables.foundry_event_training_progress ?? []).find((r) => r.id === p.p_progress_id);
  const event = (tables.foundry_events ?? []).find((r) => r.id === p.p_event_id);
  if (!progress || !event || progress.event_id !== p.p_event_id) return fail("FOUNDRY_XP_SOURCE_MISMATCH");
  if (!progress.completed_at) return fail("FOUNDRY_XP_NOT_COMPLETED");
  const participant = (tables.foundry_event_participants ?? []).find((r) => r.id === progress.participant_id);
  if ((progress.linked_user_id && progress.linked_user_id !== p.p_user_id)
    || (participant?.user_id && participant.user_id !== p.p_user_id)
    || (!progress.linked_user_id && !participant?.user_id)) return fail("FOUNDRY_XP_ACCOUNT_CONFLICT");

  const receipts = tables.foundry_xp_reward_receipts ??= [];
  const sourceReceipt = receipts.find((r) => r.progress_id === p.p_progress_id);
  if (sourceReceipt && sourceReceipt.user_id !== p.p_user_id) return fail("FOUNDRY_XP_SOURCE_MISMATCH");
  const prior = sourceReceipt ?? receipts.find((r) => r.user_id === p.p_user_id && r.event_id === p.p_event_id);
  if (prior) return result({ ...(prior.result as Row), requestedProgressId: p.p_progress_id,
    outcome: prior.progress_id === p.p_progress_id ? "already_awarded" : "event_already_awarded", replayed: true });

  if (event.owner_user_id === p.p_user_id) return nonpaid("owner_ineligible");
  const ledger = tables.core_xp_ledger ??= [];
  const source = "foundry_training_completion";
  if (progress.xp_awarded_at || ledger.some((r) => r.source_type === source && (r.source_id === p.p_progress_id
    || (r.user_id === p.p_user_id && (tables.foundry_event_training_progress ?? []).some(
      (pr) => pr.id === r.source_id && pr.event_id === p.p_event_id))))) return fail("FOUNDRY_XP_REVIEW_REQUIRED");
  const count = ledger.filter((r) => r.user_id === p.p_user_id && r.source_type === source
    && Number(r.delta_xp) > 0 && String(r.created_at) >= String(p.p_day_start)
    && String(r.created_at) < String(p.p_day_end)).length;
  if (count >= 3) return nonpaid("daily_limit");

  const profiles = tables.arena_profiles ??= [];
  let profile = profiles.find((r) => r.user_id === p.p_user_id);
  if (!profile) profiles.push(profile = { user_id: p.p_user_id, core_xp_total: 0, core_xp_buffer: 0, weekly_xp: 0, lifetime_xp: 0 });
  const before = Number(profile.core_xp_total ?? 0);
  const ledgerId = Math.max(0, ...ledger.map((r) => Number(r.id) || 0)) + 1;
  const now = new Date().toISOString();
  const receipt = { policyVersion: "foundry-core-atomic/v1", outcome: "awarded", userId: p.p_user_id,
    eventId: p.p_event_id, requestedProgressId: p.p_progress_id, awardedProgressId: p.p_progress_id,
    receiptId: fixtureUuid(1_000_000 + receipts.length), ledgerId, deltaXp: 10,
    coreBefore: before, coreAfter: before + 10, replayed: false };
  ledger.push({ id: ledgerId, user_id: p.p_user_id, delta_xp: 10, source_type: source, source_id: p.p_progress_id, created_at: now });
  profile.core_xp_total = before + 10;
  progress.xp_awarded_at = now;
  receipts.push({ receipt_id: receipt.receiptId, user_id: p.p_user_id, event_id: p.p_event_id,
    progress_id: p.p_progress_id, ledger_id: ledgerId, result: receipt, created_at: now });
  onAward?.({ userId: p.p_user_id, eventId: p.p_event_id, progressId: p.p_progress_id, deltaXp: 10 });
  return result(receipt);
}
