"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import * as Checkbox from "@radix-ui/react-checkbox";
import { cn } from "@/lib/utils";
import { SafeMirror } from "@/components/SafeMirror";
import type { DayContent } from "@/lib/journey-content";

const ENCOURAGEMENT = "오늘도 한 걸음 나아갔네요. 그대로만 가도 돼요.";

type MissionCardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: number;
  content: DayContent;
  mode: "edit" | "view";
  initialChecks?: number[];
  initialReflection?: string;
  onComplete?: (data: {
    mission_checks: number[];
    reflection_text: string;
  }) => Promise<void>;
};

export function MissionCard({
  open,
  onOpenChange,
  day,
  content,
  mode,
  initialChecks = [],
  initialReflection = "",
  onComplete,
}: MissionCardProps) {
  const [checks, setChecks] = useState<number[]>(initialChecks);
  const [reflectionDone, setReflectionDone] = useState(!!initialReflection);
  const [showEncouragement, setShowEncouragement] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allMissionsDone = content.missions.length > 0
    ? content.missions.every((_, i) => checks.includes(i))
    : false;

  const canComplete =
    mode === "edit" &&
    allMissionsDone &&
    reflectionDone &&
    !showEncouragement &&
    onComplete;

  const handleToggleCheck = useCallback((idx: number) => {
    setChecks((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  }, []);

  const handleReflectionComplete = useCallback(() => {
    setReflectionDone(true);
  }, []);

  const handleFinish = useCallback(async () => {
    if (!canComplete || isSubmitting || !onComplete) return;
    setIsSubmitting(true);
    try {
      await onComplete({
        mission_checks: checks,
        reflection_text: initialReflection || "감정을 기록했습니다.",
      });
      setShowEncouragement(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [canComplete, checks, initialReflection, onComplete, isSubmitting]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-dojo-ink/40 z-50" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(96vw,28rem)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-dojo-purple-muted bg-dojo-white shadow-xl",
            "overflow-y-auto"
          )}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center">
              <Dialog.Title className="text-xl font-semibold text-dojo-purple-dark">
                Day {day} · 오늘의 미션
              </Dialog.Title>
              <Dialog.Close
                className="rounded-lg p-2 text-dojo-ink-soft hover:bg-dojo-purple-muted/50 hover:text-dojo-ink transition-colors"
                aria-label="닫기"
                onClick={() => onOpenChange(false)}
              >
                ✕
              </Dialog.Close>
            </div>

            <AnimatePresence mode="wait">
              {showEncouragement ? (
                <motion.div
                  key="encouragement"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl bg-journey-done p-6 text-center"
                >
                  <p className="text-lg font-medium text-dojo-purple-dark">
                    {ENCOURAGEMENT}
                  </p>
                  <Dialog.Close
                    className="mt-4 px-6 py-2 rounded-xl bg-dojo-purple text-white font-medium hover:bg-dojo-purple-dark transition-colors"
                    onClick={() => onOpenChange(false)}
                  >
                    확인
                  </Dialog.Close>
                </motion.div>
              ) : (
                <motion.div
                  key="content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* 1) 오늘의 읽을거리 */}
                  <section>
                    <h3 className="text-sm font-medium text-dojo-ink-soft mb-2">
                      오늘의 읽을거리
                    </h3>
                    <p className="text-dojo-ink leading-relaxed">
                      {content.reading}
                    </p>
                  </section>

                  {/* 2) 오늘의 미션 (체크박스) */}
                  <section>
                    <h3 className="text-sm font-medium text-dojo-ink-soft mb-3">
                      오늘의 미션
                    </h3>
                    <ul className="space-y-3">
                      {content.missions.map((mission, idx) => (
                        <label
                          key={idx}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-xl border transition-colors",
                            mode === "edit" && "cursor-pointer hover:bg-dojo-purple-muted/30",
                            checks.includes(idx)
                              ? "border-dojo-purple/40 bg-dojo-purple/5"
                              : "border-dojo-purple-muted"
                          )}
                        >
                          <Checkbox.Root
                            checked={checks.includes(idx)}
                            onCheckedChange={mode === "edit" ? () => handleToggleCheck(idx) : undefined}
                            disabled={mode === "view"}
                            className={cn(
                              "mt-0.5 size-5 rounded border-2 flex items-center justify-center shrink-0",
                              checks.includes(idx)
                                ? "bg-dojo-purple border-dojo-purple"
                                : "border-dojo-purple-muted bg-white"
                            )}
                          >
                            <Checkbox.Indicator className="flex items-center justify-center text-white text-sm">
                              ✓
                            </Checkbox.Indicator>
                          </Checkbox.Root>
                          <span className="text-dojo-ink text-sm leading-relaxed">
                            {mission}
                          </span>
                        </label>
                      ))}
                    </ul>
                  </section>

                  {/* 3) 감정 기록장 (AI 채팅) — edit 모드에서만 */}
                  {mode === "edit" && (
                    <section>
                      <h3 className="text-sm font-medium text-dojo-ink-soft mb-2">
                        감정 기록장
                      </h3>
                      <p className="text-xs text-dojo-ink-soft mb-2">
                        오늘의 마음을 적어보세요. AI가 공감해줄 거예요.
                      </p>
                      <div className="rounded-xl border border-dojo-purple-muted p-4 bg-dojo-purple-muted/10">
                        <SafeMirror
                          locale="ko"
                          theme="sanctuary"
                          onPositive={handleReflectionComplete}
                        />
                      </div>
                    </section>
                  )}

                  {/* 과거 일기 보기 (view 모드) */}
                  {mode === "view" && initialReflection && (
                    <section>
                      <h3 className="text-sm font-medium text-dojo-ink-soft mb-2">
                        당시 감정 기록
                      </h3>
                      <div className="rounded-xl border border-dojo-purple-muted p-4 bg-dojo-purple-muted/10">
                        <p className="text-dojo-ink text-sm whitespace-pre-wrap">
                          {initialReflection}
                        </p>
                      </div>
                    </section>
                  )}

                  {/* 완료 버튼 (edit 모드에서만) */}
                  {mode === "edit" && (
                  <button
                    type="button"
                    onClick={handleFinish}
                    disabled={!canComplete || isSubmitting}
                    className={cn(
                      "w-full rounded-xl py-3 font-medium transition-colors",
                      canComplete
                        ? "bg-dojo-purple text-white hover:bg-dojo-purple-dark"
                        : "bg-dojo-purple-muted/50 text-dojo-ink-soft cursor-not-allowed"
                    )}
                  >
                    {isSubmitting
                      ? "저장 중…"
                      : "오늘의 미션 완료하고 기록하기"}
                  </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
