"use client";

import { createContext, useContext } from "react";

export const TeamsConsentContext = createContext<{ current: boolean; open: () => void } | null>(null);

export function useTeamsConsent() {
  return useContext(TeamsConsentContext);
}
