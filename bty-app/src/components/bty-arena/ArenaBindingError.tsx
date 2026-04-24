"use client";

import React from "react";

export function ArenaBindingError({ reason }: { reason: string }) {
  return (
    <div
      data-testid="arena-binding-error"
      role="alert"
      className="rounded-2xl border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
    >
      <p className="m-0 font-medium">Scenario binding error</p>
      <p className="mt-1 m-0 font-mono text-xs text-amber-200/90">{reason}</p>
    </div>
  );
}
