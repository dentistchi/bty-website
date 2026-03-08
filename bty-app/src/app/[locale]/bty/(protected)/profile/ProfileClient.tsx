"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BtyTopNav from "@/components/bty/BtyTopNav";
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
  const locale = (typeof params?.locale === "string" && params.locale === "ko") ? "ko" : "en";
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
      const name = res?.profile && typeof (res.profile as { display_name?: string | null }).display_name === "string"
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
      const name = typeof (data.profile as { display_name?: string | null }).display_name === "string"
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
      <div className="p-6 max-w-2xl mx-auto">
        <BtyTopNav />
        {/* DESIGN_FIRST_IMPRESSION_BRIEF §2: 스피너 대신 아이콘 + 문구 + 카드형 스켈레톤 */}
        <LoadingFallback icon="⏳" message={tLoading.message} withSkeleton style={{ paddingTop: 24 }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <BtyTopNav />
        <p className="text-sm text-red-600 mt-4">{t.errorLoad}</p>
        <Link href={`/${locale}/bty/dashboard`} className="text-sm underline mt-2 inline-block">
          {t.backToDashboard}
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <BtyTopNav />
      <div className="flex items-center justify-between mt-4">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <Link
          href={`/${locale}/bty/dashboard`}
          className="text-sm text-foundry-purple hover:underline"
        >
          {t.backToDashboard}
        </Link>
      </div>

      <section>
        <label htmlFor="profile-display-name" className="block text-sm font-medium text-gray-700 mb-1">
          {t.displayNameLabel}
        </label>
        <input
          id="profile-display-name"
          type="text"
          maxLength={65}
          placeholder={t.displayNamePlaceholder}
          value={draftDisplayName}
          onChange={(e) => setDraftDisplayName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-foundry-purple/30 focus:border-foundry-purple"
          aria-describedby={saveError ? "profile-save-error" : undefined}
        />
        {saveError && (
          <p id="profile-save-error" className="mt-2 text-sm text-red-600">
            {saveError}
          </p>
        )}
        {dirty && (
          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              aria-label={t.saveButtonAriaLabel}
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
      </section>

      <p className="text-sm text-gray-500">
        <Link href={`/${locale}/bty/profile/avatar`} className="text-foundry-purple hover:underline">
          {t.avatarSettingsLink}
        </Link>
      </p>
    </div>
  );
}
