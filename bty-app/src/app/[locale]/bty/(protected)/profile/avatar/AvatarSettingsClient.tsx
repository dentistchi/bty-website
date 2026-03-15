"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAvatar } from "@/hooks/useAvatar";
import { resolveAvatarUrls } from "@/lib/bty/arena/avatarAssets";
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
  const [saving, setSaving] = useState(false);

  const avatar = data?.avatar;
  const allowed = data?.allowed;

  useEffect(() => {
    if (avatar) {
      setDraftTheme(avatar.theme);
      setDraftOutfitKey(avatar.outfitKey);
    }
  }, [avatar?.theme, avatar?.outfitKey]);

  const dirty =
    avatar &&
    (draftTheme !== avatar.theme || draftOutfitKey !== avatar.outfitKey);

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await patch({ theme: draftTheme, outfitKey: draftOutfitKey ?? undefined });
    } finally {
      setSaving(false);
    }
  };

  const outfitsForTheme = (allowed?.outfits ?? []).filter((o) =>
    o.key.startsWith(`${draftTheme}_`)
  );

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
        accessoryKeys: avatar.accessoryKeys,
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
              accessoryKeys={avatar!.accessoryKeys}
              name={t.outfitLabels?.[o.key] ?? o.key}
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
