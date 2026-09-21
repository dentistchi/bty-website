# Quick Training Quiz V1

Quick Training may attach one optional quiz to a video, PDF, or written-guidance training. A quiz is not a material type and does not create a separate learning history.

Managers prepare a CSV or an AI-generated draft, review and edit it before creation, and the server validates the reviewed quiz before it is attached. AI output is never persisted before manager approval.

Learners first complete the existing material-engagement gate. The server then serves questions and choices only; answer keys remain hidden until that learner submits. Each participant has one immutable attempt. The server scores that attempt and returns a factual result. There is no pass/fail status, ranking, or performance label.

The immutable attempt is completion evidence. It is persisted before the ordinary idempotent Foundry completion finalizer. If finalization is interrupted, a retry uses the same attempt and retries only idempotent completion consequences: XP, anonymous claim, assignment claim, follow-up, and apply window. Quiz completion never writes a fabricated `response_text`.

Manager control rooms show each submitted factual score and aggregate submitted count and average. Existing non-quiz video, PDF, written-guidance, and live-discussion behavior remains unchanged. XP rules are unchanged.
