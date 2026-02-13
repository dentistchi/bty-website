import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const COMEBACK_STORAGE_KEY = "bty_last_visit";
export const COMEBACK_DAYS_THRESHOLD = 3;

export function getLastVisit(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(COMEBACK_STORAGE_KEY);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

export function setLastVisit(ts: number = Date.now()): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COMEBACK_STORAGE_KEY, String(ts));
}

export function shouldShowComeback(): boolean {
  const last = getLastVisit();
  if (last === null) return false;
  const days = (Date.now() - last) / (24 * 60 * 60 * 1000);
  return days >= COMEBACK_DAYS_THRESHOLD;
}
