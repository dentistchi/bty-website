# Quick Training Quiz V1

Quick Training may attach one optional quiz to a video, PDF, or written-guidance training. A quiz is not a material type and does not create a separate learning history.

Managers prepare a quiz manually, from a CSV, or from study content they paste, review and edit it in one editor before creation, and the server validates the reviewed quiz before it is attached. AI output is never persisted before manager approval.

Learners first complete the existing material-engagement gate. The server then serves questions and choices only; answer keys remain hidden until that learner submits. Each participant has one immutable attempt. The server scores that attempt and returns a factual result. There is no pass/fail status, ranking, or performance label.

The immutable attempt is completion evidence. It is persisted before the ordinary idempotent Foundry completion finalizer. If finalization is interrupted, a retry uses the same attempt and retries only idempotent completion consequences: XP, anonymous claim, assignment claim, follow-up, and apply window. Quiz completion never writes a fabricated `response_text`.

Manager control rooms show each submitted factual score and aggregate submitted count and average. Existing non-quiz video, PDF, written-guidance, and live-discussion behavior remains unchanged. XP rules are unchanged.

## Authoring V1

**Material.** Quick Training offers three materials: Video (`youtube`), PDF (`document`), and Text (`written_guidance`). Text reuses the existing written-guidance runtime exactly — the same content type, the same frozen `publishedGuidanceV1` contract inside `foundry_event_module.module_snapshot`, the same learner client, the same `written_guidance_read_at` exposure stamp, and the same completion finalizer. There is no second text-learning system and no new content table. A Quick Training has no builder draft, so `foundry_event_module.source_draft_id` is null for these rows.

**Quiz optionality.** The manager chooses "No quiz" or "Add quiz", and the choice decides the completion check.

- No quiz: the completion question remains required, exactly as before.
- Add quiz: the completion question is hidden, is not sent, and is stored as NULL. Submitting the quiz is the completion check. No placeholder question is invented, and no `response_text` is fabricated.

A completion question supplied alongside a quiz is refused (`completion_prompt_not_applicable`) rather than stored and never shown. `planCompletionEvidence` is the single place that decides this, and every non-quiz creation path behaves exactly as it always has.

**Three methods, one editor.** Manual, CSV upload, and "Generate from study content" all produce the same `QuizDraft` and land in the same editor, where the manager can add and remove questions (max 20), edit question text, edit 2–4 choices, mark exactly one correct answer, and write an optional explanation. Neither CSV nor generation publishes anything on its own.

**Provenance.** `foundry_event_quizzes.source_kind` records how the questions came to exist: `manual`, `csv`, or `generated`. It changes only when the draft is replaced, so a quiz an AI drafted stays `generated` however much the manager then edits it. An unrecognised or missing value is refused, never coerced.

**Generation.** The AI box is source material — what the employee should study — never a quiz question. The request uses a strict JSON schema, falls back to plain JSON mode only when the provider cannot honour a schema, strips code fences defensively, assigns question ids and positions server-side, and refuses any question whose `sourceEvidence` is not a substantial verbatim span of the supplied source. Too little source material is refused before the provider is called, with the required length named.

**Atomicity.** The event and its material are created first, then the quiz. A failed quiz insert compensates by deleting the event, so a training meant to be completed by a quiz never goes live without one.

**Storage.** Migration `20260924000000_quick_training_quiz_authoring_v1.sql` makes `completion_prompt` nullable on both content tables (keeping the 1–300 bound for every present value) and `foundry_event_module.source_draft_id` nullable. NULL means "the completion check is the quiz"; the service layer is what guarantees that, because the database cannot read the quiz table from a constraint on the content table.

## Next product direction (NOT built in this mission)

**Quiz follow-up / review conversation.** A manager looking at a factual score — `4 / 5 · 80%` — taps it and is offered **"Review 1 missed question"**. The learner then receives a Teams-native review invitation, and BTY asks conversationally: *"Want to review one question?"* — a short 2–3 turn reinforcement around ONE missed concept.

What it is not, and must not become: an automatic punishment, a pass/fail verdict, a scheduled reminder, or a manager ranking. The learner is invited, not summoned.

This is deliberately distinct from the existing 7/30-day follow-up, which exists for **behavioral application** — whether the person did the thing — and not for ordinary knowledge-quiz remediation. The two must not be collapsed: one asks "did you act", the other offers "shall we look at that one idea again".

Not implemented. Recorded here so the next slice starts from the product shape rather than re-deriving it.
