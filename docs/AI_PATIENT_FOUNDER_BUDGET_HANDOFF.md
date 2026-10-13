# AI Patient Founder pilot — dedicated OpenAI spend-control handoff

Status: **code prepared, NOT merged/deployed; OpenAI project/key/hard limit NOT configured or verified here.**

## Why this change exists

Live operating verification of the Founder-only pilot found that the existing KV limiter accepted 40 consecutive test requests without the expected 429. After 42 requests KV recorded only 23. The requests were deliberately invalid and did not incur model cost, but the accounting test **FAILED**. Keep this as an unresolved limitation. KV remains a supplementary best-effort user throttle, **not** a guaranteed global or exact daily cost meter. No claim of an exact 40-request gate is authorized.

The pilot now routes **all five cost-bearing model operations** through a dedicated OpenAI API project key:
- patient replies
- communication coaching
- separate safety screening
- voice transcription
- patient text-to-speech

No AI Patient call may fall back to the shared BTY `OPENAI_API_KEY`, `LLM_API_KEY` or `LLM_BASE_URL`. Other BTY features keep their existing provider configuration. Without `AI_PATIENT_OPENAI_API_KEY` the AI Patient start rejects with 503, voice reports unavailable, and Practice's pilot entry is hidden. Founder allowlist and consent/auth checks remain in force.

## OpenAI owner action — required before merging/deploying

1. Sign in to the OpenAI API Platform with project-owner permissions.
2. Create a dedicated project, e.g. **BTY Arena — AI Patient Founder Pilot**. Do **not** reuse BTY's unrelated production-project key.
3. In **Project settings → Limits → Spend → Edit spend limit**, set a small monthly amount (suggested **$20** for this one-person pilot), enable **Enforce a hard limit**, and Save. **A spend alert alone does not block traffic.**
4. Verify the saved setting really says **hard limit enforcement enabled** for the *dedicated project*, not merely a notification threshold. Where an authorized Admin API key is available, `GET /v1/organization/projects/{project_id}/spend_limit` offers a second verification; do not print secrets or project key values.
5. Create a scoped API key belonging to that same project, with permissions required for chat completions and audio. Keep it secret, and set `AI_PATIENT_OPENAI_API_KEY` as a Cloudflare **Worker secret** using the established source-aware release procedure. Do not insert the key in GitHub, logs, chat messages, or `.env.example`.
6. Confirm provider usage appears under that project and the other BTY AI features still use their original keys.

Official guide: https://developers.openai.com/api/docs/guides/spend-limits

**Limits:** OpenAI says hard-limit enforcement is not instantaneous, so monthly costs can exceed the configured amount slightly. This is a **spend safeguard**, not an exact 40-request limit. An ordinary monthly project budget or email alert is not enough.

## Release gates

- Current production baseline: `b3b5c1dc88408b9097b4fc6a2fd5b17e3b8d1268` at release handoff; refresh actual `inner-main` before any merge.
- This PR: code-only. **No merge, deployment, Worker secret write or Teams app update** was authorized by this handoff.
- Before release: verify the dedicated project's enforced hard limit and key, PR tests and build, worker environment bindings and accurate source SHA.
- Existing `AI_PATIENT_SESSION_SECRET` and `AI_PATIENT_ALLOWED_USER_IDS` remain set. Pilot allowlist stays Founder-only. Test another consented, non-allowlisted account if authorized; do not claim this is proven on production until observed.
- After an authorized deploy: Founder text-turn and feedback smoke, billed project check, other-app regressions, no unexpected persistence. Check key missing state closes access when appropriate.
- Only then update the **existing Teams app** with manifest **1.0.15**, and run a Founder desktop/mobile real-device mic/transcription/voice/playback and text-fallback test.
- Do not mark Teams microphone support PASS from Chromium/workerd evidence alone.
- Do not enroll or notify employees. Do not modify published Trainings or blocked Practice drafts.

## Rollback

To immediately close the pilot, remove/revoke the Founder entries from `AI_PATIENT_ALLOWED_USER_IDS` through the authorized secret-management procedure. Verify the AI Patient door is hidden and paid endpoints reject access. This does not change other BTY app functions.
