"use client";

import React from "react";
import type { ArenaSessionRouterSnapshot } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import { ArenaPendingContractGate } from "@/components/bty-arena/ArenaPendingContractGate";
import type { ArenaPendingContractPayload } from "@/lib/bty/arena/arenaSessionRouterClient";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

function GenericBlockedState({ snapshot }: { snapshot: ArenaSessionRouterSnapshot }) {
  const rs = snapshot.runtime_state;
  return (
    <div data-testid="arena-blocked-generic" className="rounded-2xl border border-bty-border bg-bty-surface/90 p-4 text-sm text-bty-navy">
      <p className="m-0 font-medium">Session blocked</p>
      <p className="mt-1 m-0 text-bty-navy/80">{rs}</p>
    </div>
  );
}

function ForcedResetGateStub({ locale }: { locale: Locale | string }) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  return (
    <div data-testid="arena-forced-reset-gate" className="rounded-2xl border border-bty-border bg-bty-surface/90 p-4 text-sm text-bty-navy">
      <p className="m-0 font-medium">{t.arenaSnapshotForcedResetPlaceholder}</p>
    </div>
  );
}

function ReExposureGateStub({ locale }: { locale: Locale | string }) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  return (
    <div data-testid="arena-reexposure-gate" className="rounded-2xl border border-bty-border bg-bty-surface/90 p-4 text-sm text-bty-navy">
      <p className="m-0 font-medium">{t.arenaSnapshotReexposurePlaceholder}</p>
    </div>
  );
}

export type ArenaBlockedSurfaceProps = {
  snapshot: ArenaSessionRouterSnapshot;
  locale: Locale | string;
  /** When 409 contract payload exists (session router), pass it for action-contract gates. */
  pendingContract?: ArenaPendingContractPayload | null;
  onRetrySession?: () => void;
  retryLoading?: boolean;
};

/**
 * Render-only blocked surface from snapshot authority — no local step logic.
 */
export function ArenaBlockedSurface({
  snapshot,
  locale,
  pendingContract = null,
  onRetrySession,
  retryLoading = false,
}: ArenaBlockedSurfaceProps) {
  const rs = snapshot.runtime_state;
  switch (rs) {
    case "ACTION_REQUIRED":
    case "ACTION_SUBMITTED":
    case "ACTION_AWAITING_VERIFICATION":
      if (pendingContract) {
        return (
          <ArenaPendingContractGate
            locale={locale}
            contract={pendingContract}
            onRetry={onRetrySession ?? (() => {})}
            retryLoading={retryLoading}
          />
        );
      }
      return <GenericBlockedState snapshot={snapshot} />;
    case "FORCED_RESET_PENDING":
      return <ForcedResetGateStub locale={locale} />;
    case "REEXPOSURE_DUE":
      return <ReExposureGateStub locale={locale} />;
    default:
      return <GenericBlockedState snapshot={snapshot} />;
  }
}
