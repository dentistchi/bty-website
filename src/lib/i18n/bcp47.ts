import type { Locale } from "@/lib/i18n";

const BCP47_MAP: Record<Locale, string> = {
  en: "en-US",
  ko: "ko-KR",
};

export function localeToBcp47(locale: Locale): string {
  return BCP47_MAP[locale] ?? "en-US";
}

export function bcp47ToLocale(bcp47: string): Locale {
  if (bcp47.toLowerCase().startsWith("ko")) return "ko";
  return "en";
}

export const SUPPORTED_BCP47 = Object.values(BCP47_MAP);
