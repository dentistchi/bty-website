"use client";

import React from "react";
import {
  ArenaHeader,
  OutputPanel,
  TierMilestoneModal,
  CardSkeleton,
  ArenaRankingSidebar,
  EmptyState,
  LoadingFallback,
  ArenaStepIntro,
  ArenaStepChoose,
  ArenaOtherResult,
  ArenaOtherModal,
  ArenaToast,
  ArenaRunHistory,
  LabUsageStrip,
} from "@/components/bty-arena";
import BtyTopNav from "@/components/bty/BtyTopNav";
import { getMessages } from "@/lib/i18n";
import { useArenaSession, OTHER_CHOICE_ID } from "./hooks/useArenaSession";

export default function BtyArenaPage() {
  const s = useArenaSession();
  const { locale, t } = s;
  const tLoading = getMessages(locale === "ko" ? "ko" : "en").loading;

  // ── gate: level check loading ─────────────────────────────
  if (!s.levelChecked) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
        <BtyTopNav />
        <div style={{ marginTop: 24 }} aria-busy="true" aria-label={tLoading.message}>
          <LoadingFallback
            icon="📋"
            message={tLoading.message}
            withSkeleton
          />
        </div>
      </div>
    );
  }

  // ── gate: beginner redirect (effect handles navigation; Gate 2: API requiresBeginnerPath only, no coreXpTotal < 200) ───
  if (s.requiresBeginnerPath) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
        <BtyTopNav />
        <div style={{ marginTop: 24, display: "grid", gap: 20 }}>
          <CardSkeleton lines={2} showLabel={true} />
        </div>
      </div>
    );
  }

  // ── gate: no scenario ─────────────────────────────────────
  if (!s.scenario) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
        <BtyTopNav />
        <div style={{ marginTop: 24, border: "1px solid #eee", borderRadius: 14, background: "var(--arena-card)" }}>
          <EmptyState icon="📋" message={t.scenarioNotFound} hint={t.scenarioNotFoundHint} />
        </div>
      </div>
    );
  }

  // ── main render ───────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "stretch",
        maxWidth: 1200, margin: "0 auto", padding: "24px 16px",
      }}
      className="bty-arena-page-root lg:flex-row lg:gap-6"
    >
      <div
        style={{
          display: "flex", flexDirection: "column", flex: 1,
          minWidth: 0, maxWidth: 860, margin: "0 auto", width: "100%",
        }}
      >
      <BtyTopNav />
      <LabUsageStrip locale={locale} />
      <div style={{ marginTop: 18 }}>
        {s.step === 1 && (
          <div className="bty-hero" style={{ paddingTop: 32, paddingBottom: 40, marginBottom: 28 }}>
            <p className="bty-hero-title" style={{ margin: 0, fontSize: "clamp(1.75rem, 4vw, 2rem)", fontWeight: 700, letterSpacing: "0.02em", lineHeight: 1.35, color: "var(--arena-text)" }}>
              {t.heroTitle}
            </p>
          </div>
        )}

        <ArenaHeader locale={locale} step={s.step} phase={s.phase} runId={s.runId} onPause={s.pause} onReset={s.resetRun} showPause={false} />

        {s.resetRunLoading && (
          <div style={{ marginTop: 10 }} aria-busy="true" aria-label={locale === "ko" ? "새 시나리오 준비 중…" : "Preparing new scenario…"}>
            <p
              style={{
                margin: 0,
                padding: "8px 0 6px",
                fontSize: 13,
                color: "var(--arena-text-soft)",
                opacity: 0.9,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              aria-live="polite"
            >
              <span aria-hidden style={{ fontSize: 16 }}>🔄</span>
              {locale === "ko" ? "새 시나리오 준비 중…" : "Preparing new scenario…"}
            </p>
            <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
          </div>
        )}
        {s.completeError && (
          <div role="alert" style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#fff7f7", border: "1px solid #f1c0c0", fontSize: 14, color: "#8b2e2e" }}>
            {s.completeError}
          </div>
        )}

      <div role="region" aria-label={locale === "ko" ? "시나리오 진행·완료" : "Scenario progress and result"} style={{ marginTop: 18, padding: 18, border: "1px solid #eee", borderRadius: 14 }}>
        {s.step === 1 && (
          <ArenaStepIntro
            locale={locale}
            displayTitle={s.displayTitle}
            contextForUser={s.contextForUser}
            onStart={s.onStartSimulation}
            startLoading={s.startSimulationLoading}
            runId={s.runId}
          />
        )}

        {s.step >= 2 && (
          <>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>{s.displayTitle}</h2>
            <p style={{ marginTop: 0, lineHeight: 1.6, opacity: 0.9 }}>{s.contextForUser}</p>
          </>
        )}

        {s.step === 2 && (
          <ArenaStepChoose
            locale={locale}
            choices={s.scenario.choices}
            selectedChoiceId={s.selectedChoiceId === OTHER_CHOICE_ID ? null : s.selectedChoiceId}
            onSelectChoice={s.selectChoice}
            onSelectOther={s.selectOther}
            otherLabel={t.otherLabel}
            showActions={s.phase === "CHOOSING"}
            confirmDisabled={!s.selectedChoiceId || s.selectedChoiceId === OTHER_CHOICE_ID || s.confirmingChoice}
            onConfirm={s.onConfirmChoice}
            onContinue={s.continueNextScenario}
            confirmingChoice={s.confirmingChoice}
          />
        )}

        {s.step >= 3 && s.selectedChoiceId === OTHER_CHOICE_ID && (
          <ArenaOtherResult
            locale={locale}
            freeResponseFeedback={s.freeResponseFeedback}
            systemMessage={s.systemMessage}
            otherRecordedLabel={t.otherRecorded}
            lastXp={s.lastXp}
            nextScenarioLabel={t.nextScenario}
            onContinue={s.continueNextScenario}
            continueLoading={s.nextScenarioLoading}
          />
        )}

        {s.step >= 3 && s.choice && (
          <OutputPanel
            locale={locale}
            step={s.step as 3 | 4 | 5 | 6 | 7}
            choice={s.choice}
            systemMessage={s.systemMessage}
            lastXp={s.lastXp}
            reflectionBonusXp={s.reflectionBonusXp}
            reflectionPrompt={t.reflectionPrompt}
            reflectionOptions={[]}
            followUpPrompt={s.followUpPrompt}
            followUpOptions={s.followUpOptions}
            hasFollowUp={s.hasFollowUp}
            followUpIndex={s.followUpIndex}
            reflectResult={s.reflectResult}
            onNextToReflection={s.goToReflection}
            onSubmitReflection={s.submitReflection}
            reflectionSubmitting={s.reflectionSubmitting}
            onSubmitFollowUp={s.submitFollowUp}
            onSkipFollowUp={s.handleSkipFollowUp}
            followUpSubmitting={s.followUpSubmitting}
            onComplete={s.handleComplete}
            onContinue={s.continueNextScenario}
            continueLoading={s.nextScenarioLoading}
          />
        )}
      </div>

      <ArenaRunHistory locale={locale} />
      </div>

      {s.otherOpen && (
        <ArenaOtherModal
          locale={locale}
          otherLabel={t.otherLabel}
          placeholder={t.otherPlaceholder}
          cancelLabel={t.cancel}
          submitLabel={t.submit}
          text={s.otherText}
          onChangeText={s.setOtherText}
          error={s.otherError}
          submitting={s.otherSubmitting}
          onSubmit={s.submitOther}
          onClose={s.closeOtherModal}
        />
      )}

      {s.milestoneModal && (
        <TierMilestoneModal
          milestone={s.milestoneModal.milestone}
          subName={s.milestoneModal.subName}
          previousSubName={s.milestoneModal.previousSubName}
          subNameRenameAvailable={s.milestoneModal.subNameRenameAvailable}
          onRename={s.milestoneModal.subNameRenameAvailable ? s.onRenameSubName : undefined}
          onClose={s.closeMilestoneModal}
        />
      )}
    </div>
    <aside
      aria-label={t.liveRanking}
      style={{ width: 280, flexShrink: 0, paddingTop: 32 }}
      className="hidden lg:block"
    >
      <ArenaRankingSidebar locale={locale} />
    </aside>

    {s.toast && <ArenaToast message={s.toast} />}
  </div>
  );
}
