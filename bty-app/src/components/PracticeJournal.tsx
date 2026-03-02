"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { appendPracticeEntry } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

/**
 * The Imperfect Practice Log (오늘의 연습)
 * - 카드 UI, '성공' / '실패했지만 기록함' 버튼
 * - 실패 시 격려 모달 → LocalStorage 저장 → 나의 여정 그래프에 반영
 */

type RecordType = "success" | "failure" | null;

const FAILURE_MODAL_MESSAGE =
  "돌아와줘서 고마워요. 기록하는 순간 이미 어제보다 나아진 겁니다.";
const FAILURE_HEADLINE = "오늘의 bty 성공";
const FAILURE_CARD_MESSAGE =
  "다시 돌아와줘서 고마워요. 실패를 인정하고 돌아온 용기가 바로 bty입니다.";
const SUCCESS_MESSAGE = "오늘도 한 걸음 연습하셨네요. 그대로만 가도 돼요.";

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function JournalLayout({
  recorded,
  message,
  onRecord,
  onReset,
  failureModalOpen,
  onCloseFailureModal,
}: {
  recorded: RecordType;
  message: string | null;
  onRecord: (type: RecordType) => void;
  onReset: () => void;
  failureModalOpen: boolean;
  onCloseFailureModal: () => void;
}) {
  return (
    <>
      <div
        role="region"
        aria-labelledby="practice-journal-heading"
        className={cn(
          "rounded-2xl border border-foundry-purple-muted bg-foundry-white",
          "shadow-sm overflow-hidden"
        )}
      >
        <div className="p-6 sm:p-8 border-b border-foundry-purple-muted bg-foundry-purple/5">
          <h2
            id="practice-journal-heading"
            className="text-xl font-semibold text-foundry-purple-dark"
          >
            오늘의 연습
          </h2>
          <p className="text-sm text-foundry-ink-soft mt-1">
            완료가 아니라 오늘의 연습을 기록합니다. 실패한 날도 기록할 수 있어요.
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {!recorded ? (
            <>
              <p className="text-sm text-foundry-ink mb-3">
                오늘 어떤 연습이었는지 골라주세요.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onRecord("success")}
                  className={cn(
                    "flex-1 rounded-xl py-4 px-4 text-center font-medium",
                    "border-2 border-foundry-purple-muted bg-foundry-purple-muted/30 text-foundry-ink",
                    "hover:bg-foundry-purple-muted/50 transition-colors"
                  )}
                >
                  성공
                </button>
                <button
                  type="button"
                  onClick={() => onRecord("failure")}
                  className={cn(
                    "flex-1 rounded-xl py-4 px-4 text-center font-medium",
                    "border-2 border-foundry-purple/40 bg-foundry-white text-foundry-ink",
                    "hover:bg-foundry-purple/5 hover:border-foundry-purple/60 transition-colors"
                  )}
                >
                  실패했지만 기록함
                </button>
              </div>
            </>
          ) : (
            <div
              className={cn(
                "rounded-xl p-5 border",
                recorded === "failure"
                  ? "border-foundry-purple/30 bg-foundry-purple/5"
                  : "border-foundry-purple-muted bg-foundry-purple-muted/20"
              )}
            >
              {recorded === "failure" && (
                <p
                  className="text-lg font-semibold text-foundry-purple-dark mb-3"
                  aria-label="오늘의 bty 성공"
                >
                  {FAILURE_HEADLINE}
                </p>
              )}
              <p
                className={cn(
                  "text-foundry-ink leading-relaxed",
                  recorded === "failure" && "font-medium"
                )}
              >
                {message}
              </p>
              <p className="mt-3 text-xs text-foundry-ink-soft">
                이 기록 자체가 오늘의 연습이에요.
              </p>
              <button
                type="button"
                onClick={onReset}
                className="mt-4 text-sm text-foundry-purple hover:underline"
              >
                오늘의 연습 다시 기록하기
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={failureModalOpen}
        onClose={onCloseFailureModal}
        title="오늘의 bty 성공"
      >
        <div className="p-6 sm:p-8">
          <p className="text-foundry-ink leading-relaxed text-center">
            {FAILURE_MODAL_MESSAGE}
          </p>
          <button
            type="button"
            onClick={onCloseFailureModal}
            className={cn(
              "mt-6 w-full rounded-xl py-3 font-medium",
              "bg-foundry-purple text-foundry-white hover:bg-foundry-purple-dark",
              "transition-colors"
            )}
          >
            확인
          </button>
        </div>
      </Modal>
    </>
  );
}

export function PracticeJournal({
  onRecordComplete,
}: {
  onRecordComplete?: () => void;
}) {
  const [recorded, setRecorded] = useState<RecordType>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failureModalOpen, setFailureModalOpen] = useState(false);

  const handleRecord = useCallback(
    (type: RecordType) => {
      if (type !== "success" && type !== "failure") return;
      const date = getTodayDate();
      appendPracticeEntry({ date, type });
      onRecordComplete?.();

      if (type === "failure") {
        setFailureModalOpen(true);
        setRecorded("failure");
        setMessage(FAILURE_CARD_MESSAGE);
      } else {
        setRecorded("success");
        setMessage(SUCCESS_MESSAGE);
      }
    },
    [onRecordComplete]
  );

  const handleCloseFailureModal = useCallback(() => {
    setFailureModalOpen(false);
  }, []);

  const handleReset = useCallback(() => {
    setRecorded(null);
    setMessage(null);
  }, []);

  return (
    <JournalLayout
      recorded={recorded}
      message={message}
      onRecord={handleRecord}
      onReset={handleReset}
      failureModalOpen={failureModalOpen}
      onCloseFailureModal={handleCloseFailureModal}
    />
  );
}
