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

  const previewUrls = avatar
    ? resolveAvatarUrls({
        characterKey: avatar.characterKey,
        outfitKey: draftOutfitKey ?? undefined,
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
        <p className="text-sm text-red-600">Failed to load avatar settings.</p>
        <Link href={`/${locale}/bty`} className="text-sm underline mt-2 inline-block" aria-label={locale === "ko" ? "훈련장으로 돌아가기" : "Back to Foundry"}>
          Back to Foundry
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Avatar</h1>
        <Link
          href={`/${locale}/bty/dashboard`}
          className="text-sm text-foundry-purple hover:underline"
          aria-label={locale === "ko" ? "대시보드로 가기" : "Go to Dashboard"}
        >
          Dashboard
        </Link>
      </div>

      {/* 미리보기 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Preview</h2>
        <div className="flex justify-center p-6 rounded-2xl border border-gray-200 bg-gray-50/50">
          {previewUrls && (
            <AvatarComposite
              size={160}
              characterUrl={previewUrls.characterUrl}
              outfitUrl={previewUrls.outfitUrl}
              accessoryUrls={previewUrls.accessoryUrls}
              alt="Avatar preview"
            />
          )}
        </div>
      </section>

      {/* 캐릭터 변경 (잠김 시 비활성) */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Character</h2>
        {avatar?.characterLocked ? (
          <p className="text-sm text-gray-500">
            캐릭터 변경(잠김) — 다음 Code 진화 전까지 고정됩니다.
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            캐릭터 변경은 대시보드에서 할 수 있어요.
          </p>
        )}
        <Link
          href={`/${locale}/bty/dashboard`}
          className="inline-block mt-2 text-sm font-medium text-foundry-purple hover:underline"
        >
          Go to Dashboard
        </Link>
      </section>

      {/* Theme 토글 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">{t?.label ?? "Theme"}</h2>
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

      {/* Outfit Gallery */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Outfit</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {outfitsForTheme.map((o) => (
            <OutfitCard
              key={o.key}
              characterKey={avatar!.characterKey}
              outfitKey={o.key}
              accessoryKeys={avatar!.accessoryKeys}
              name={o.name}
              selected={draftOutfitKey === o.key}
              onClick={() => setDraftOutfitKey(o.key)}
            />
          ))}
        </div>
        {outfitsForTheme.length === 0 && (
          <p className="text-sm text-gray-500">No outfits available for this theme.</p>
        )}
      </section>

      {/* 저장 */}
      {dirty && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            aria-label={saving ? (locale === "ko" ? "저장 중" : "Saving") : (locale === "ko" ? "저장" : "Save")}
            className="px-6 py-2 rounded-xl bg-foundry-purple text-white font-medium hover:bg-foundry-purple/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
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
