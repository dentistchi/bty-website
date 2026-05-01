"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAvatar } from "@/hooks/useAvatar";
import { resolveAvatarUrls } from "@/lib/bty/arena/avatarAssets";
import { ACCESSORY_IDS_ALL } from "@/lib/bty/arena/avatar-assets.data";
import { getUnifiedOutfitManifestAllowed, getAccessoryImageUrl, ACCESSORY_CATALOG } from "@/lib/bty/arena/avatarOutfits";
import { getAvatarCharacter } from "@/lib/bty/arena/avatarCharacters";
import { AvatarComposite, CardSkeleton, OutfitCard, LoadingFallback } from "@/components/bty-arena";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { PrimaryButton } from "@/components/bty/ui/PrimaryButton";
import { SecondaryButton } from "@/components/bty/ui/SecondaryButton";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * AVATAR_LAYER_SPEC §5.1, §5.4: 아바타 설정 페이지.
 * useAvatar → 미리보기, Theme 토글, Outfit Gallery(allowed.outfits), 저장. characterLocked 시 캐릭터 변경 비활성.
 */

export default function AvatarSettingsClient() {
  const params = useParams();
  const locale = typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en";
  const { data, loading, patch } = useAvatar();
  const t = getMessages(locale).avatarOutfit;
  const [draftOutfitKey, setDraftOutfitKey] = useState<string | null>(null);
  const [draftAccessoryKeys, setDraftAccessoryKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const avatar = data?.avatar;
  const allowed = data?.allowed;
  const maxAccessorySlots = allowed?.accessorySlots ?? 5;

  useEffect(() => {
    if (avatar) {
      setDraftOutfitKey(avatar.outfitKey);
      setDraftAccessoryKeys(avatar.accessoryKeys ?? []);
    }
  }, [avatar?.outfitKey, avatar?.accessoryKeys]);

  const accessoryKeysEqual =
    (avatar?.accessoryKeys?.length ?? 0) === draftAccessoryKeys.length &&
    draftAccessoryKeys.every((k, i) => (avatar?.accessoryKeys ?? [])[i] === k);
  const dirty =
    avatar && (draftOutfitKey !== avatar.outfitKey || !accessoryKeysEqual);

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await patch({
        outfitKey: draftOutfitKey ?? undefined,
        accessoryKeys: draftAccessoryKeys,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleAccessory = (id: string) => {
    setDraftAccessoryKeys((prev) =>
      prev.includes(id)
        ? prev.filter((k) => k !== id)
        : prev.length >= maxAccessorySlots
          ? prev
          : [...prev, id]
    );
  };

  /** 통합 옷 목록(매니페스트). API가 비어 있으면 클라이언트 폴백. */
  const outfitChoices: { key: string; label?: string }[] =
    (allowed?.outfits?.length ?? 0) > 0 ? allowed!.outfits : getUnifiedOutfitManifestAllowed();

  /** §1: `outfit_{id}` 또는 레거시 키 — resolveAvatarUrls에 그대로 전달. */
  const previewOutfitKey = draftOutfitKey ?? undefined;

  const previewBodyType = avatar?.characterKey
    ? getAvatarCharacter(avatar.characterKey)?.bodyType
    : undefined;

  const previewUrls = avatar
    ? resolveAvatarUrls({
        characterKey: avatar.characterKey,
        outfitKey: previewOutfitKey,
        accessoryKeys: draftAccessoryKeys,
        useThumb: false,
        bodyType: previewBodyType ?? undefined,
      })
    : null;

  const accessorySectionTitle = locale === "ko" ? "악세사리" : "Accessories";

  if (loading) {
    const tLoading = getMessages(locale).loading;
    return (
      <ScreenShell
        locale={locale}
        title={t.pageTitle}
        fullWidth
        contentClassName="pb-28 px-4"
        mainAriaLabel={t.avatarSettingsMainRegionAria}
      >
        <div className="mx-auto max-w-2xl">
          <LoadingFallback icon="⏳" message={tLoading.message} withSkeleton style={{ paddingTop: 24 }} />
        </div>
      </ScreenShell>
    );
  }

  if (!data) {
    return (
      <ScreenShell
        locale={locale}
        title={t.pageTitle}
        fullWidth
        contentClassName="pb-28 px-4"
        mainAriaLabel={t.avatarSettingsMainRegionAria}
      >
        <div className="mx-auto max-w-2xl space-y-3">
          <InfoCard title={locale === "ko" ? "오류" : "Error"} tone="warning">
            <p className="text-sm">{t.errorLoad}</p>
          </InfoCard>
          <SecondaryButton href={`/${locale}/bty`}>{t.backToFoundry}</SecondaryButton>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      locale={locale}
      title={t.pageTitle}
      fullWidth
      contentClassName="pb-28 px-4"
      mainAriaLabel={t.avatarSettingsMainRegionAria}
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex justify-end">
          <Link
            href={`/${locale}/bty/dashboard`}
            className="text-sm font-medium text-bty-steel underline-offset-4 hover:underline"
            aria-label={t.goToDashboardAria}
          >
            {t.goToDashboard}
          </Link>
        </div>

        <InfoCard title={t.preview}>
          <div className="flex justify-center rounded-2xl border border-bty-border bg-bty-soft/50 p-6">
            {previewUrls && (
              <AvatarComposite
                size={160}
                characterUrl={previewUrls.characterUrl}
                outfitUrl={previewUrls.outfitUrl}
                accessoryUrls={previewUrls.accessoryUrls}
                alt={t.previewAria}
              />
            )}
          </div>
        </InfoCard>

        <InfoCard title={t.character}>
          {avatar?.characterLocked ? (
            <p className="text-sm text-bty-secondary">{t.characterLocked}</p>
          ) : (
            <p className="text-sm text-bty-secondary">{t.characterChangeHint}</p>
          )}
          <Link
            href={`/${locale}/bty/dashboard`}
            className="mt-2 inline-block text-sm font-medium text-bty-navy underline-offset-4 hover:underline"
          >
            {t.goToDashboard}
          </Link>
        </InfoCard>

        <InfoCard title={t.outfit}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {outfitChoices.map((o) => (
              <OutfitCard
                key={o.key}
                characterKey={avatar!.characterKey}
                outfitKey={o.key}
                accessoryKeys={draftAccessoryKeys}
                name={
                  t.outfitLabels?.[o.key] ??
                  (o as { name?: string }).name ??
                  (o as { label?: string }).label ??
                  o.key
                }
                previewLabel={t.preview}
                selected={draftOutfitKey === o.key}
                onClick={() => setDraftOutfitKey(o.key)}
              />
            ))}
          </div>
          {outfitChoices.length === 0 && <p className="text-sm text-bty-secondary">{t.noOutfits}</p>}
        </InfoCard>

        <InfoCard title={accessorySectionTitle}>
          <section role="group" aria-label={locale === "ko" ? "악세사리 선택" : "Accessory selection"}>
            <p className="text-sm text-bty-secondary">
              {locale === "ko"
                ? `최대 ${maxAccessorySlots}개 선택. 미리보기에 반영됩니다.`
                : `Select up to ${maxAccessorySlots}. Shown in preview.`}
            </p>
            <div
              className="mt-3 grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6"
              role="list"
              aria-label={locale === "ko" ? "악세사리 목록" : "Accessories list"}
            >
              {Array.from(ACCESSORY_IDS_ALL).map((id) => {
                const selected = draftAccessoryKeys.includes(id);
                const url = getAccessoryImageUrl(id);
                const label = ACCESSORY_CATALOG[id] ?? id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleAccessory(id)}
                    aria-label={selected ? `${label}, selected` : label}
                    className={cn(
                      "flex flex-col items-center rounded-lg border p-2 transition",
                      selected
                        ? "border-bty-steel bg-bty-steel/10"
                        : "border-bty-border hover:border-bty-steel/40"
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-bty-soft">
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                    <span className="mt-1 w-full truncate text-center text-xs">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </InfoCard>

        {dirty && (
          <div className="flex flex-col items-end gap-2">
            <PrimaryButton type="button" onClick={handleSave} disabled={saving} className="max-w-xs">
              {saving ? t.saving : t.save}
            </PrimaryButton>
            {saving && (
              <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
            )}
          </div>
        )}
      </div>
    </ScreenShell>
  );
}
