"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { PrimaryButton } from "@/components/bty/ui/PrimaryButton";
import { SecondaryButton } from "@/components/bty/ui/SecondaryButton";
import { CardSkeleton, LoadingFallback } from "@/components/bty-arena";
import { getMessages } from "@/lib/i18n";
import { arenaFetch } from "@/lib/http/arenaFetch";
import type { CoreXpGetResponse } from "@/lib/bty/arena/coreXpApi";

type ProfileRes = {
  profile?: { display_name?: string | null };
  avatarCharacterId?: string | null;
};

export default function ProfileClient() {
  const params = useParams();
  const locale = typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en";
  const t = getMessages(locale).profile;
  const tLoading = getMessages(locale).loading;
  const isKo = locale === "ko";

  const [data, setData] = useState<ProfileRes | null>(null);
  const [coreXp, setCoreXp] = useState<CoreXpGetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sub-name rename state
  const [draftSubName, setDraftSubName] = useState("");
  const [savingSubName, setSavingSubName] = useState(false);
  const [subNameError, setSubNameError] = useState<string | null>(null);
  const [subNameSaved, setSubNameSaved] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, coreRes] = await Promise.all([
        arenaFetch<ProfileRes>("/api/arena/profile"),
        arenaFetch<CoreXpGetResponse>("/api/arena/core-xp"),
      ]);
      setData(profileRes);
      setCoreXp(coreRes);
      const name =
        profileRes?.profile && typeof (profileRes.profile as { display_name?: string | null }).display_name === "string"
          ? (profileRes.profile as { display_name: string }).display_name
          : "";
      setDraftDisplayName(name ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "FAILED");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    if (data?.profile) {
      const name =
        typeof (data.profile as { display_name?: string | null }).display_name === "string"
          ? (data.profile as { display_name: string }).display_name
          : "";
      setDraftDisplayName(name ?? "");
    }
  }, [data?.profile]);

  const currentDisplayName =
    data?.profile && typeof (data.profile as { display_name?: string | null }).display_name === "string"
      ? (data.profile as { display_name: string }).display_name ?? ""
      : "";
  const dirty = draftDisplayName.trim() !== currentDisplayName;

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await arenaFetch("/api/arena/profile", {
        method: "PATCH",
        json: { display_name: draftDisplayName.trim() || null },
      });
      await fetchProfile();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSaveError(msg === "DISPLAY_NAME_TOO_LONG" ? t.errorTooLong : t.errorSave);
    } finally {
      setSaving(false);
    }
  };

  const handleSubNameSave = async () => {
    const trimmed = draftSubName.trim();
    if (!trimmed || savingSubName) return;
    setSavingSubName(true);
    setSubNameError(null);
    setSubNameSaved(false);
    try {
      await arenaFetch("/api/arena/profile", {
        method: "PATCH",
        json: { sub_name: trimmed },
      });
      setSubNameSaved(true);
      setDraftSubName("");
      await fetchProfile();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "SUB_NAME_RENAME_NOT_AVAILABLE") {
        setSubNameError(isKo ? "지금은 변경할 수 없습니다." : "Rename not available right now.");
      } else {
        setSubNameError(isKo ? "저장에 실패했어요." : "Save failed.");
      }
    } finally {
      setSavingSubName(false);
    }
  };

  if (loading) {
    return (
      <ScreenShell locale={locale} title={t.title} fullWidth contentClassName="pb-28 px-4" mainAriaLabel={t.profileMainRegionAria}>
        <div className="mx-auto max-w-md">
          <LoadingFallback icon="⏳" message={tLoading.message} withSkeleton style={{ paddingTop: 24 }} />
        </div>
      </ScreenShell>
    );
  }

  if (error || !data) {
    return (
      <ScreenShell locale={locale} title={t.title} fullWidth contentClassName="pb-28 px-4" mainAriaLabel={t.profileMainRegionAria}>
        <div className="mx-auto max-w-md space-y-3">
          <InfoCard title={isKo ? "오류" : "Error"} tone="warning">
            <p className="text-sm">{t.errorLoad}</p>
          </InfoCard>
          <SecondaryButton href={`/${locale}/bty/dashboard`}>{t.backToDashboard}</SecondaryButton>
        </div>
      </ScreenShell>
    );
  }

  const codeName = coreXp?.codeName ?? "FORGE";
  const subName = coreXp?.subName ?? "";
  const tier = coreXp?.tier ?? 0;
  const tierInCode = tier % 100;
  const coreXpTotal = coreXp?.coreXpTotal ?? 0;
  const stageNumber = Math.min(7, Math.floor(coreXpTotal / 100) + 1);
  const subNameRenameAvailable = coreXp?.subNameRenameAvailable === true;

  return (
    <ScreenShell locale={locale} title={t.title} fullWidth contentClassName="pb-28 px-4" mainAriaLabel={t.profileMainRegionAria}>
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex justify-end">
          <Link
            href={`/${locale}/bty/dashboard`}
            className="text-sm font-medium text-bty-steel underline-offset-4 hover:underline"
            aria-label={t.backToDashboard}
          >
            {t.backToDashboard}
          </Link>
        </div>

        {/* Code Identity */}
        <InfoCard title={isKo ? "코드 정체성" : "Code Identity"}>
          <div className="space-y-3">
            {/* Code Name badge */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-bty-secondary">{isKo ? "코드네임" : "Code Name"}</span>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-bty-navy/10 px-3 py-1 text-sm font-bold tracking-widest text-bty-navy">
                    {codeName}
                  </span>
                  <span className="text-xs text-bty-secondary">Stage {stageNumber} / 7</span>
                </div>
              </div>
              <div className="ml-auto flex flex-col items-end gap-0.5">
                <span className="text-xs text-bty-secondary">{isKo ? "현재 티어" : "Tier"}</span>
                <span className="text-sm font-medium text-bty-text">{tierInCode} / 100</span>
              </div>
            </div>

            {/* Progress bar within code */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bty-border">
              <div
                className="h-full rounded-full bg-bty-steel transition-all"
                style={{ width: `${tierInCode}%` }}
              />
            </div>
            {/* Milestone markers */}
            <div className="flex justify-between px-0.5 text-[10px] text-bty-secondary/60">
              {[25, 50, 75, 100].map((m) => (
                <span key={m} className={tierInCode >= m ? "text-bty-steel" : ""}>{m}</span>
              ))}
            </div>

            {/* Sub-name */}
            <div className="rounded-lg border border-bty-border bg-bty-soft/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] text-bty-secondary">{isKo ? "서브네임" : "Sub Name"}</p>
                  <p className="text-sm font-medium text-bty-text">{subName || "—"}</p>
                </div>
                {subNameRenameAvailable && !subNameSaved && (
                  <span className="rounded-full bg-bty-steel/15 px-2 py-0.5 text-[10px] font-semibold text-bty-steel">
                    {isKo ? "변경 가능" : "Rename available"}
                  </span>
                )}
                {subNameSaved && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    {isKo ? "저장됨" : "Saved"}
                  </span>
                )}
              </div>

              {subNameRenameAvailable && !subNameSaved && (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    maxLength={20}
                    placeholder={isKo ? "새 서브네임 (최대 20자)" : "New sub name (max 20 chars)"}
                    value={draftSubName}
                    onChange={(e) => setDraftSubName(e.target.value)}
                    className="w-full rounded-lg border border-bty-border bg-white px-3 py-1.5 text-sm text-bty-text outline-none focus:border-bty-steel focus:ring-2 focus:ring-bty-steel/20"
                  />
                  {subNameError && (
                    <p className="text-xs text-bty-risk">{subNameError}</p>
                  )}
                  <PrimaryButton
                    type="button"
                    onClick={handleSubNameSave}
                    disabled={!draftSubName.trim() || savingSubName}
                    className="max-w-xs"
                  >
                    {savingSubName
                      ? (isKo ? "저장 중…" : "Saving…")
                      : (isKo ? "서브네임 저장" : "Save sub name")}
                  </PrimaryButton>
                </div>
              )}
            </div>

            <p className="text-[11px] text-bty-secondary/70 leading-relaxed">
              {isKo
                ? "코드네임은 Core XP에 따라 자동으로 진화합니다. 서브네임은 25티어마다 변경 기회가 주어집니다."
                : "Code name evolves automatically with Core XP. Sub name can be changed at every 25-tier milestone."}
            </p>
          </div>
        </InfoCard>

        {/* Display Name */}
        <InfoCard title={t.displayNameLabel}>
          <label htmlFor="profile-display-name" className="sr-only">
            {t.displayNameLabel}
          </label>
          <input
            id="profile-display-name"
            type="text"
            maxLength={65}
            placeholder={t.displayNamePlaceholder}
            value={draftDisplayName}
            onChange={(e) => setDraftDisplayName(e.target.value)}
            className="w-full rounded-xl border border-bty-border bg-bty-surface px-3 py-2 text-sm text-bty-text outline-none focus:border-bty-steel focus:ring-2 focus:ring-bty-steel/25"
            aria-describedby={saveError ? "profile-save-error" : undefined}
          />
          {saveError && (
            <p id="profile-save-error" className="mt-2 text-sm text-bty-risk">
              {saveError}
            </p>
          )}
          {dirty && (
            <div className="mt-3 flex flex-col gap-2">
              <PrimaryButton type="button" onClick={handleSave} disabled={saving} className="max-w-xs">
                {saving ? t.saving : t.save}
              </PrimaryButton>
              {saving && <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />}
            </div>
          )}
        </InfoCard>

        {/* Avatar link */}
        <InfoCard title={isKo ? "아바타" : "Avatar"}>
          <p className="text-sm text-bty-secondary">
            <Link
              href={`/${locale}/bty/profile/avatar`}
              className="font-medium text-bty-navy underline-offset-4 hover:underline"
              aria-label={t.avatarSettingsLink}
            >
              {t.avatarSettingsLink}
            </Link>
          </p>
        </InfoCard>
      </div>
    </ScreenShell>
  );
}
