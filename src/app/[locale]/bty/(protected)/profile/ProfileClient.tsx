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

/**
 * 프로필 페이지: API 응답만 표시, PATCH로만 제출. UI에서 XP·랭킹 계산 금지.
 * GET /api/arena/profile → profile.display_name 표시·편집.
 */
type ProfileRes = {
  profile?: { display_name?: string | null };
  avatarCharacterId?: string | null;
};

export default function ProfileClient() {
  const params = useParams();
  const locale = typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en";
  const t = getMessages(locale).profile;
  const tLoading = getMessages(locale).loading;

  const [data, setData] = useState<ProfileRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await arenaFetch<ProfileRes>("/api/arena/profile");
      setData(res);
      const name =
        res?.profile && typeof (res.profile as { display_name?: string | null }).display_name === "string"
          ? (res.profile as { display_name: string }).display_name
          : "";
      setDraftDisplayName(name ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "FAILED");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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
          <InfoCard title={locale === "ko" ? "오류" : "Error"} tone="warning">
            <p className="text-sm">{t.errorLoad}</p>
          </InfoCard>
          <SecondaryButton href={`/${locale}/bty/dashboard`}>{t.backToDashboard}</SecondaryButton>
        </div>
      </ScreenShell>
    );
  }

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

        <InfoCard title={locale === "ko" ? "아바타" : "Avatar"}>
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
