"use client";

export function EmptyStateGuide({
  onInsertSample,
  canInsertSample,
  insertingSample,
  insertResult,
}: {
  onInsertSample?: () => void;
  canInsertSample: boolean;
  insertingSample?: boolean;
  insertResult?: { inserted?: number; error?: string } | null;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
      <h3 className="text-lg font-semibold text-neutral-700">
        What should I fix this week?
      </h3>
      <p className="mt-2 text-neutral-600">
        Emulator/Teams 대화 5~10회 후 데이터가 표시됩니다.
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        원문 대화는 저장/표시하지 않음(시그니처/집계만).
      </p>
      {canInsertSample && onInsertSample && (
        <div className="mt-4">
          <button
            onClick={onInsertSample}
            disabled={insertingSample}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {insertingSample ? "Inserting…" : "Insert Sample Events (dev only)"}
          </button>
          {insertResult?.inserted !== undefined && (
            <p className="mt-2 text-sm text-emerald-600">
              Inserted {insertResult.inserted} events.
            </p>
          )}
          {insertResult?.error && (
            <p className="mt-2 text-sm text-red-600">
              Error: {insertResult.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
