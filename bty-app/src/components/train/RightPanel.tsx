"use client";

import { useTrainUI } from "@/contexts/TrainUIContext";

export function RightPanel() {
  const { tab, setTab, completion, packLoading, openChatPanel, clearCompletion } = useTrainUI();

  return (
    <div className="h-full flex flex-col border-l bg-white">
      <div className="p-3 flex items-center gap-2 border-b">
        <button
          className={`px-3 py-1 rounded-full text-sm ${tab === "chat" ? "bg-black text-white" : "bg-gray-100"}`}
          onClick={openChatPanel}
        >
          Coach Chat
        </button>
        <button
          className={`px-3 py-1 rounded-full text-sm ${tab === "completion" ? "bg-black text-white" : "bg-gray-100"}`}
          onClick={() => setTab("completion")}
        >
          Completion Summary
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tab === "chat" && (
          <div className="space-y-3">
            <h3 className="font-semibold">Coach Chat</h3>
            <div className="text-sm text-gray-600">
              (Placeholder) Later: inject lesson context + save chat history.
            </div>

            <div className="rounded-xl border p-3 text-sm text-gray-700 bg-gray-50">
              Prompt idea:
              <div className="mt-2">
                &quot;Today is Day X. Help me shrink the core action into a 10-minute version and keep me accountable.&quot;
              </div>
            </div>
          </div>
        )}

        {tab === "completion" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Completion Summary</h3>
              {completion && (
                <button className="text-sm underline text-gray-500" onClick={clearCompletion}>
                  Clear
                </button>
              )}
            </div>

            {packLoading && (
              <div className="text-sm text-gray-600">Generating your summary...</div>
            )}

            {!packLoading && !completion && (
              <div className="text-sm text-gray-600">
                Mark today as complete to generate your summary and 3 reinforcement questions.
              </div>
            )}

            {!packLoading && completion && (
              <>
                <div className="rounded-2xl border p-4">
                  {completion.title && (
                    <div className="text-sm font-medium mb-2">
                      Day {completion.day}: {completion.title}
                    </div>
                  )}
                  {!completion.title && (
                    <div className="text-sm font-medium mb-2">Day {completion.day}</div>
                  )}

                  <ul className="mt-3 list-disc pl-5 space-y-2 text-sm">
                    {completion.summary.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="font-medium">3 Reinforcement Questions</div>
                  <ol className="mt-3 list-decimal pl-5 space-y-2 text-sm">
                    {completion.questions.slice(0, 3).map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>

                  <div className="mt-4 text-xs text-gray-500">
                    (Later) These answers can be passed into the chat model as context.
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
