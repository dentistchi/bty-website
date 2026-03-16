"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAvatar } from "@/hooks/useAvatar";
import { resolveAvatarUrls } from "@/lib/bty/arena/avatarAssets";
import { ACCESSORY_IDS_ALL } from "@/lib/bty/arena/avatar-assets.data";
import { getOutfitsForTheme, FANTASY_THEME_UI_READY, getAccessoryImageUrl, ACCESSORY_CATALOG } from "@/lib/bty/arena/avatarOutfits";
import { AvatarComposite, CardSkeleton, OutfitCard, LoadingFallback } from "@/components/bty-arena";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * AVATAR_LAYER_SPEC §5.1, §5.4: 아바타 설정 페이지.
 * useAvatar → 미리보기, Theme 토글, Outfit Gallery(allowed.outfits), 저장. characterLocked 시 캐릭터 변경 비활성.
 */

export default function AvatarSettingsClient() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const { data, loading, patch } = useAvatar();
  const t = getMessages(locale === "ko" ? "ko" : "en").avatarOutfit;
  const [draftTheme, setDraftTheme] = useState<"professional" | "fantasy">("professional");
  const [draftOutfitKey, setDraftOutfitKey] = useState<string | null>(null);
  const [draftAccessoryKeys, setDraftAccessoryKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const avatar = data?.avatar;
  const allowed = data?.allowed;
  const maxAccessorySlots = allowed?.accessorySlots ?? 5;

  useEffect(() => {
    if (avatar) {
      setDraftTheme(avatar.theme);
      setDraftOutfitKey(avatar.outfitKey);
      setDraftAccessoryKeys(avatar.accessoryKeys ?? []);
    }
  }, [avatar?.theme, avatar?.outfitKey, avatar?.accessoryKeys]);

  const accessoryKeysEqual =
    (avatar?.accessoryKeys?.length ?? 0) === draftAccessoryKeys.length &&
    draftAccessoryKeys.every((k, i) => (avatar?.accessoryKeys ?? [])[i] === k);
  const dirty =
    avatar &&
    (draftTheme !== avatar.theme ||
      draftOutfitKey !== avatar.outfitKey ||
      !accessoryKeysEqual);

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await patch({
        theme: draftTheme,
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

  const apiOutfitsForTheme = (allowed?.outfits ?? []).filter((o) =>
    o.key.startsWith(`${draftTheme}_`)
  );
  /** Professional 7종·Fantasy 7종. API 비어 있으면 getOutfitsForTheme(동기화된 목록) 기반 폴백. Fantasy는 FANTASY_THEME_UI_READY일 때만 목록 표시. */
  const outfitsForTheme: { key: string; label?: string }[] =
    apiOutfitsForTheme.length > 0
      ? apiOutfitsForTheme
      : draftTheme === "fantasy" && !FANTASY_THEME_UI_READY
        ? []
        : getOutfitsForTheme(draftTheme).map((o) => ({
            key: `${draftTheme}_outfit_${o.outfitId}`,
            label: o.outfitLabel,
          }));

  /** §1: Full outfit key (theme_outfit_outfitId) for resolveAvatarUrls so Preview/thumbnail get correct outfitUrl. */
  const previewOutfitKey =
    draftOutfitKey && draftOutfitKey.includes("_outfit_")
      ? draftOutfitKey
      : draftOutfitKey && draftTheme
        ? `${draftTheme}_outfit_${draftOutfitKey}`
        : draftOutfitKey ?? undefined;

  const previewUrls = avatar
    ? resolveAvatarUrls({
        characterKey: avatar.characterKey,
        outfitKey: previewOutfitKey,
        accessoryKeys: draftAccessoryKeys,
        useThumb: false,
      })
    : null;

  if (loading) {
    const tLoading = getMessages(locale === "ko" ? "ko" : "en").loading;
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <LoadingFallback icon="⏳" message={tLoading.message} withSkeleton style={{ paddingTop: 24 }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-sm text-red-600">{t.errorLoad}</p>
        <Link href={`/${locale}/bty`} className="text-sm underline mt-2 inline-block" aria-label={t.backToFoundryAria}>
          {t.backToFoundry}
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
        <Link
          href={`/${locale}/bty/dashboard`}
          className="text-sm text-foundry-purple hover:underline"
          aria-label={t.goToDashboardAria}
        >
          {t.goToDashboard}
        </Link>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">{t.preview}</h2>
        <div className="flex justify-center p-6 rounded-2xl border border-gray-200 bg-gray-50/50">
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
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">{t.character}</h2>
        {avatar?.characterLocked ? (
          <p className="text-sm text-gray-500">{t.characterLocked}</p>
        ) : (
          <p className="text-sm text-gray-600">{t.characterChangeHint}</p>
        )}
        <Link
          href={`/${locale}/bty/dashboard`}
          className="inline-block mt-2 text-sm font-medium text-foundry-purple hover:underline"
        >
          {t.goToDashboard}
        </Link>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">{t.label}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDraftTheme("professional")}
            aria-label={t?.professional ?? "Professional"}
            className={cn(
              "px-4 py-2 rounded-lg border font-medium transition",
              draftTheme === "professional"
                ? "border-foundry-purple bg-foundry-purple/10 text-foundry-purple"
                : "border-gray-200 hover:border-gray-400"
            )}
          >
            {t?.professional ?? "Professional"}
          </button>
          <button
            type="button"
            onClick={() => setDraftTheme("fantasy")}
            aria-label={t?.fantasy ?? "Fantasy"}
            className={cn(
              "px-4 py-2 rounded-lg border font-medium transition",
              draftTheme === "fantasy"
                ? "border-foundry-purple bg-foundry-purple/10 text-foundry-purple"
                : "border-gray-200 hover:border-gray-400"
            )}
          >
            {t?.fantasy ?? "Fantasy"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">{t.outfit}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {outfitsForTheme.map((o) => (
            <OutfitCard
              key={o.key}
              characterKey={avatar!.characterKey}
              outfitKey={o.key}
              accessoryKeys={draftAccessoryKeys}
              name={t.outfitLabels?.[o.key] ?? (o as { label?: string }).label ?? o.key}
              previewLabel={t.preview}
              selected={draftOutfitKey === o.key}
              onClick={() => setDraftOutfitKey(o.key)}
            />
          ))}
        </div>
        {outfitsForTheme.length === 0 && (
          <p className="text-sm text-gray-500">{t.noOutfits}</p>
        )}
      </section>

      <section role="group" aria-label={locale === "ko" ? "악세사리 선택" : "Accessory selection"}>
        <h2 className="text-lg font-semibold mb-3">{locale === "ko" ? "악세사리" : "Accessories"}</h2>
        <p className="text-sm text-gray-600 mb-3">
          {locale === "ko"
            ? `최대 ${maxAccessorySlots}개 선택. 미리보기에 반영됩니다.`
            : `Select up to ${maxAccessorySlots}. Shown in preview.`}
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-64 overflow-y-auto" role="list" aria-label={locale === "ko" ? "악세사리 목록" : "Accessories list"}>
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
                  "flex flex-col items-center p-2 rounded-lg border transition",
                  selected ? "border-foundry-purple bg-foundry-purple/10" : "border-gray-200 hover:border-gray-400"
                )}
              >
                <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded overflow-hidden">
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                <span className="text-xs mt-1 truncate w-full text-center">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {dirty && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            aria-label={saving ? t.saveAria : t.saveAria}
            className="px-6 py-2 rounded-xl bg-foundry-purple text-white font-medium hover:bg-foundry-purple/90 disabled:opacity-50"
          >
            {saving ? t.saving : t.save}
          </button>
          {saving && (
            <div className="mt-3">
              <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
