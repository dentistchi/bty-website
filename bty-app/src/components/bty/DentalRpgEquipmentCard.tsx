"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Dental RPG 장비 카드 UI — render-only.
 * docs/spec/DENTAL_RPG_EQUIPMENT_SYSTEM.md. 목록·레어리티(1=Common … 5=Legendary) 표시.
 * 데이터는 API/props만 사용. 기존 악세사리 이미지 URL 활용 가능.
 */

export type DentalRpgEquipmentItem = {
  id: string;
  label: string;
  /** Rarity 1–5 (1=common … 5=legendary). */
  rarity: 1 | 2 | 3 | 4 | 5;
  /** Optional image URL (e.g. /avatars/accessories/{id}.svg). */
  imageUrl?: string | null;
};

const RARITY_KEYS = ["rarity1", "rarity2", "rarity3", "rarity4", "rarity5"] as const;

function getRarityLabel(locale: Locale, rarity: number): string {
  const t = getMessages(locale).dentalRpg;
  const key = RARITY_KEYS[Math.max(0, Math.min(rarity - 1, 4))];
  return t[key] ?? `Rarity ${rarity}`;
}

function getRarityColorClass(rarity: number): string {
  switch (rarity) {
    case 1: return "bg-gray-200 text-gray-800";
    case 2: return "bg-green-100 text-green-800";
    case 3: return "bg-blue-100 text-blue-800";
    case 4: return "bg-purple-100 text-purple-800";
    case 5: return "bg-amber-100 text-amber-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

export interface DentalRpgEquipmentCardProps {
  item: DentalRpgEquipmentItem;
  locale?: Locale;
  className?: string;
}

export function DentalRpgEquipmentCard({ item, locale = "en", className }: DentalRpgEquipmentCardProps) {
  const effectiveLocale = locale === "ko" ? "ko" : "en";
  const rarityLabel = getRarityLabel(effectiveLocale, item.rarity);

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-gray-300",
        className
      )}
      role="article"
      aria-label={`${item.label}, ${rarityLabel}`}
    >
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              className="h-full w-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="text-lg text-gray-400" aria-hidden>◆</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
          <span
            className={cn(
              "inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium",
              getRarityColorClass(item.rarity)
            )}
          >
            {rarityLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

export interface DentalRpgEquipmentListProps {
  items: DentalRpgEquipmentItem[];
  locale?: Locale;
  className?: string;
  emptyMessage?: string;
}

export function DentalRpgEquipmentList({
  items,
  locale = "en",
  className,
  emptyMessage,
}: DentalRpgEquipmentListProps) {
  const t = getMessages(locale === "ko" ? "ko" : "en").dentalRpg;

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4 text-center">
        {emptyMessage ?? t.empty}
      </p>
    );
  }

  return (
    <ul className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3 list-none p-0 m-0", className)} role="list" aria-label={t.listAria}>
      {items.map((item) => (
        <li key={item.id}>
          <DentalRpgEquipmentCard item={item} locale={locale} />
        </li>
      ))}
    </ul>
  );
}
