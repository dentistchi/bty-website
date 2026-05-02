"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAvatar } from "@/hooks/useAvatar";
import { resolveAvatarUrls } from "@/lib/bty/arena/avatarAssets";
import { ACCESSORY_IDS_ALL, GAME_ACCESSORY_IDS } from "@/lib/bty/arena/avatar-assets.data";
import { getAccessoryImageUrl, ACCESSORY_CATALOG, OUTFIT_OPTIONS_ALL } from "@/lib/bty/arena/avatarOutfits";
import {
  AVATAR_CHARACTERS,
  getAvatarCharacter,
} from "@/lib/bty/arena/avatarCharacters";
import { AvatarComposite, CardSkeleton, LoadingFallback } from "@/components/bty-arena";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { PrimaryButton } from "@/components/bty/ui/PrimaryButton";
import { SecondaryButton } from "@/components/bty/ui/SecondaryButton";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { arenaFetch } from "@/lib/http/arenaFetch";

export default function AvatarSettingsClient() {
  const params = useParams();
  const locale = typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en";
  const { data, loading, refresh } = useAvatar();
  const t = getMessages(locale).avatarOutfit;
  const isKo = locale === "ko";

  // Draft state for outfit / accessories
  const [draftOutfitKey, setDraftOutfitKey] = useState<string | null>(null);
  const [draftAccessoryKeys, setDraftAccessoryKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Draft state for character (separate save path)
  const [draftCharacterKey, setDraftCharacterKey] = useState<string | null>(null);
  const [savingCharacter, setSavingCharacter] = useState(false);
  const [characterError, setCharacterError] = useState<string | null>(null);

  const avatar = data?.avatar;
  const allowed = data?.allowed;
  const maxAccessorySlots = allowed?.accessorySlots ?? 5;

  // Set of unlocked outfit keys from API
  const unlockedOutfitKeys = new Set((allowed?.outfits ?? []).map((o) => o.key));
  // Set of unlocked accessory keys from API
  const unlockedAccessoryKeys = new Set((allowed?.accessories ?? []).map((a) => a.key));

  useEffect(() => {
    if (avatar) {
      setDraftOutfitKey(avatar.outfitKey);
      setDraftAccessoryKeys(avatar.accessoryKeys ?? []);
    }
  }, [avatar?.outfitKey, avatar?.accessoryKeys]);

  const accessoryKeysEqual =
    (avatar?.accessoryKeys?.length ?? 0) === draftAccessoryKeys.length &&
    draftAccessoryKeys.every((k, i) => (avatar?.accessoryKeys ?? [])[i] === k);
  const dirty = avatar && (draftOutfitKey !== avatar.outfitKey || !accessoryKeysEqual);

  const handleSaveOutfitAccessories = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/arena/profile/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outfitKey: draftOutfitKey ?? undefined,
          accessoryKeys: draftAccessoryKeys,
        }),
        credentials: "include",
      });
      if (r.ok) await refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCharacter = async () => {
    if (!draftCharacterKey || savingCharacter) return;
    setSavingCharacter(true);
    setCharacterError(null);
    try {
      await arenaFetch("/api/arena/profile", {
        method: "PATCH",
        json: { avatarCharacterId: draftCharacterKey },
      });
      setDraftCharacterKey(null);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "AVATAR_CHARACTER_LOCKED") {
        setCharacterError(isKo ? "캐릭터는 이미 영구 설정되었습니다." : "Character is permanently locked.");
      } else {
        setCharacterError(isKo ? "저장에 실패했어요." : "Save failed.");
      }
    } finally {
      setSavingCharacter(false);
    }
  };

  const toggleAccessory = (id: string) => {
    if (!unlockedAccessoryKeys.has(id)) return; // locked
    setDraftAccessoryKeys((prev) =>
      prev.includes(id)
        ? prev.filter((k) => k !== id)
        : prev.length >= maxAccessorySlots
          ? prev
          : [...prev, id]
    );
  };

  const previewBodyType = (draftCharacterKey ?? avatar?.characterKey)
    ? getAvatarCharacter(draftCharacterKey ?? avatar!.characterKey)?.bodyType
    : undefined;

  const effectiveCharacterKey = draftCharacterKey ?? avatar?.characterKey ?? "";
  const previewUrls = resolveAvatarUrls({
    characterKey: effectiveCharacterKey,
    outfitKey: undefined, // MVP: no outfit compositing
    accessoryKeys: [],
    useThumb: false,
    bodyType: previewBodyType ?? undefined,
  });

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
          <InfoCard title={isKo ? "오류" : "Error"} tone="warning">
            <p className="text-sm">{t.errorLoad}</p>
          </InfoCard>
          <SecondaryButton href={`/${locale}/bty`}>{t.backToFoundry}</SecondaryButton>
        </div>
      </ScreenShell>
    );
  }

  const isCharacterLocked = avatar?.characterLocked === true;
  const activeCharacterKey = avatar?.characterKey ?? "";

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

        {/* Preview */}
        <InfoCard title={t.preview}>
          <div className="flex justify-center rounded-2xl border border-bty-border bg-bty-soft/50 p-6">
            {previewUrls?.characterUrl ? (
              <AvatarComposite
                size={160}
                characterUrl={previewUrls.characterUrl}
                outfitUrl={undefined}
                accessoryUrls={[]}
                alt={t.previewAria}
              />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-full bg-bty-soft text-4xl">
                👤
              </div>
            )}
          </div>
          {draftCharacterKey && draftCharacterKey !== activeCharacterKey && (
            <p className="mt-2 text-center text-xs text-bty-steel">
              {isKo ? "⚠ 선택 후 저장하면 영구 설정됩니다." : "⚠ Saving will permanently lock this character."}
            </p>
          )}
        </InfoCard>

        {/* Character selection */}
        <InfoCard title={isKo ? "캐릭터" : "Character"}>
          {isCharacterLocked ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-xl border border-bty-border bg-bty-soft/40 p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-bty-soft">
                  <img
                    src={getAvatarCharacter(activeCharacterKey)?.imageUrl ?? ""}
                    alt=""
                    className="h-full w-full object-contain"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-bty-text">
                    {AVATAR_CHARACTERS.find((c) => c.id === activeCharacterKey)?.label ?? activeCharacterKey}
                  </p>
                  <p className="text-xs text-bty-secondary flex items-center gap-1">
                    <span>🔒</span>
                    <span>{isKo ? "영구 설정됨 — 변경 불가" : "Permanently set — cannot be changed"}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-bty-secondary">
                {isKo
                  ? "캐릭터를 선택하세요. 한 번 저장하면 변경할 수 없습니다."
                  : "Choose your character. Once saved, it cannot be changed."}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {AVATAR_CHARACTERS.filter((c) => c.unlockAtTier == null).map((c) => {
                  const selected = (draftCharacterKey ?? activeCharacterKey) === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setDraftCharacterKey(c.id)}
                      aria-label={selected ? `${c.label}, ${isKo ? "선택됨" : "selected"}` : c.label}
                      className={cn(
                        "flex flex-col items-center rounded-xl border p-2 transition",
                        selected
                          ? "border-bty-steel bg-bty-steel/10 ring-2 ring-bty-steel/40"
                          : "border-bty-border hover:border-bty-steel/40"
                      )}
                    >
                      <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-bty-soft">
                        <img
                          src={c.imageUrl}
                          alt=""
                          className="h-full w-full object-contain"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      </div>
                      <span className="mt-1 w-full truncate text-center text-xs text-bty-text">{c.label}</span>
                    </button>
                  );
                })}
              </div>
              {characterError && (
                <p className="text-sm text-bty-risk">{characterError}</p>
              )}
              {draftCharacterKey && draftCharacterKey !== activeCharacterKey && (
                <PrimaryButton
                  type="button"
                  onClick={handleSaveCharacter}
                  disabled={savingCharacter}
                  className="max-w-xs"
                >
                  {savingCharacter
                    ? (isKo ? "저장 중…" : "Saving…")
                    : (isKo ? "이 캐릭터로 영구 설정" : "Set this character permanently")}
                </PrimaryButton>
              )}
            </div>
          )}
        </InfoCard>

        {/* Outfits — ALL shown, locked = semi-transparent */}
        <InfoCard title={isKo ? "의상" : "Outfits"}>
          <p className="mb-3 text-sm text-bty-secondary">
            {isKo
              ? "진행에 따라 의상이 해금됩니다. 🔒 표시는 아직 획득하지 못한 의상입니다."
              : "Outfits unlock as you progress. 🔒 items haven't been earned yet."}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {OUTFIT_OPTIONS_ALL.map((o) => {
              const outfitKey = `outfit_${o.outfitId}`;
              const unlocked = unlockedOutfitKeys.has(outfitKey);
              const selected = unlocked && draftOutfitKey === outfitKey;
              return (
                <button
                  key={outfitKey}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => unlocked && setDraftOutfitKey(outfitKey)}
                  aria-label={unlocked
                    ? (selected ? `${o.outfitLabel}, ${isKo ? "선택됨" : "selected"}` : o.outfitLabel)
                    : `${o.outfitLabel} (${isKo ? "잠금" : "locked"})`}
                  className={cn(
                    "relative flex flex-col items-center rounded-xl border p-2 transition",
                    unlocked
                      ? selected
                        ? "border-bty-steel bg-bty-steel/10 ring-2 ring-bty-steel/40"
                        : "border-bty-border hover:border-bty-steel/40 cursor-pointer"
                      : "border-bty-border/40 opacity-40 cursor-not-allowed"
                  )}
                >
                  {!unlocked && (
                    <span className="absolute right-1.5 top-1.5 text-[10px]">🔒</span>
                  )}
                  <div className="h-20 w-full overflow-hidden rounded-lg bg-bty-soft/60 flex items-center justify-center">
                    <img
                      src={`/avatars/outfits/outfit_${o.outfitId}.png`}
                      alt=""
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                  <span className="mt-1 w-full truncate text-center text-[11px] text-bty-text leading-tight">
                    {o.outfitLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </InfoCard>

        {/* Accessories — ALL shown, locked = semi-transparent */}
        <InfoCard title={isKo ? "악세사리" : "Accessories"}>
          <p className="mb-3 text-sm text-bty-secondary">
            {isKo
              ? `최대 ${maxAccessorySlots}개 선택. 🔒 표시는 아직 획득하지 못한 악세사리입니다.`
              : `Select up to ${maxAccessorySlots}. 🔒 items haven't been earned yet.`}
          </p>
          <div
            className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6"
            role="list"
            aria-label={isKo ? "악세사리 목록" : "Accessories list"}
          >
            {Array.from(ACCESSORY_IDS_ALL).filter((id) => !GAME_ACCESSORY_IDS.has(id)).map((id) => {
              const unlocked = unlockedAccessoryKeys.has(id);
              const selected = unlocked && draftAccessoryKeys.includes(id);
              const url = getAccessoryImageUrl(id);
              const label = ACCESSORY_CATALOG[id] ?? id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => toggleAccessory(id)}
                  aria-label={unlocked
                    ? (selected ? `${label}, selected` : label)
                    : `${label} (locked)`}
                  className={cn(
                    "relative flex flex-col items-center rounded-lg border p-2 transition",
                    unlocked
                      ? selected
                        ? "border-bty-steel bg-bty-steel/10"
                        : "border-bty-border hover:border-bty-steel/40 cursor-pointer"
                      : "border-bty-border/40 opacity-40 cursor-not-allowed"
                  )}
                >
                  {!unlocked && (
                    <span className="absolute right-1 top-1 text-[8px]">🔒</span>
                  )}
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-bty-soft">
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full object-contain"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  </div>
                  <span className="mt-1 w-full truncate text-center text-xs">{label}</span>
                </button>
              );
            })}
          </div>
        </InfoCard>

        {/* Save outfit/accessories */}
        {dirty && (
          <div className="flex flex-col items-end gap-2">
            <PrimaryButton type="button" onClick={handleSaveOutfitAccessories} disabled={saving} className="max-w-xs">
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
