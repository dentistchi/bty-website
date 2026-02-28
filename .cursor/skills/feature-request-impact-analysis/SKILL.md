---
name: feature-request-impact-analysis
description: Analyzes BTY Arena feature requests and outputs domain, data/schema, API, UI, auth/deployment risk, workstream ownership, and MVP vs full scope. Use when the user pastes a feature request and asks for impact analysis, or when they use the placeholder "<<< {PASTE FEATURE HERE} >>>". Analysis only; no implementation.
---

# Feature Request Impact Analysis

Analyze the pasted feature request and produce a structured impact analysis. **Do not implement.** Output only the seven sections below.

## Input

The user provides the feature request in one of these forms:
- Text between `<<<` and `>>>` (e.g. `<<< {PASTE FEATURE HERE} >>>` with the actual request pasted)
- Or any clearly stated feature description in the message

## Output Template

Use this structure. Replace placeholders with concrete, scoped statements. Be concise.

```markdown
# Feature Impact Analysis: [Short feature title]

## 1) Domain impact (rules that change)
- **Rules affected:** [e.g. Core XP vs Weekly XP, level/tier/stage mapping, season lifecycle, leaderboard rules]
- **New/changed concepts:** [e.g. new entity, new boundary, new invariant]
- **Edge cases:** [boundaries, resets, ties, empty state]
- **Rule statement:** [One-line non-negotiable preserved or new]

## 2) Data/Schema impact (tables/indexes)
- **Tables/views:** [new, modified, or unchanged]
- **Indexes:** [hot paths: leaderboard, user lookup, week_id, etc.]
- **Constraints:** [uniqueness, FKs, check]
- **Core vs Weekly XP separation:** [confirmed preserved or what changes]

## 3) API impact (endpoints/contracts)
- **New endpoints:** [method, path, purpose]
- **Modified endpoints:** [path, what changes in request/response]
- **Contracts:** [request/response shapes, breaking vs additive]
- **Auth:** [who can call what; any new scopes]

## 4) UI impact (screens/components)
- **Screens:** [new pages, modified pages, routes]
- **Components:** [new or changed; props/data from API only]
- **Data flow:** [UI consumes precomputed data from ___; no XP/rank logic in UI]
- **Code Name / progress labels:** [Weekly vs Season vs Lifetime (Core) — any change?]

## 5) Auth/Deployment risk
- **Auth:** [session, cookies, middleware, new protected routes]
- **Runtime:** [edge vs node; Cloudflare/OpenNext impact]
- **Rollback:** [what to revert if needed]
- **Verification:** [login, logout, session, cookies checklist if auth touched]

## 6) Suggested workstreams (subagent ownership)
| Workstream        | Owner                    | Scope |
|-------------------|--------------------------|-------|
| Domain rules/spec | bty-domain-architect     | ...   |
| Schema/migrations | bty-arena-data-engineer  | ...   |
| Engine/XP logic   | bty-engine-implementer   | ...   |
| API routes        | (no dedicated agent)     | ...   |
| UI/screens        | bty-arena-ui             | ...   |
| Auth/deploy       | bty-auth-deploy-safety   | ...   |
| Rules review      | bty-arena-rules          | ...   |

Only include rows that apply. Assign concrete scope per row (what that agent owns for this feature).

## 7) Minimal MVP vs Full version
- **MVP:** [smallest shippable slice: scope, one or two bullets]
- **Full:** [complete feature: scope, what’s included beyond MVP]
- **Cut line:** [what is explicitly out of scope for both]
```

## Rules for the analysis

1. **Analysis only.** Do not write code, migrations, or component implementations. Only describe impact and ownership.
2. **Preserve BTY Arena rules.** Season must not affect leaderboard rank; Core XP permanent; Weekly XP for weekly ranking only; no business logic in UI; pure domain/engine.
3. **Be concrete.** Name tables, endpoints, components, and agents. Avoid vague “may need” without saying where.
4. **Workstreams.** Map only to existing subagents: `bty-domain-architect`, `bty-arena-data-engineer`, `bty-engine-implementer`, `bty-arena-ui`, `bty-auth-deploy-safety`, `bty-arena-rules`. API has no dedicated agent — list as “(no dedicated agent)” with scope.
5. **MVP vs Full.** MVP = smallest safe, shippable slice. Full = complete feature. Cut line = explicitly out of scope.

## When to apply

- User asks for “impact analysis,” “analyze this feature,” or similar.
- User pastes a feature request with `<<< ... >>>` or a clear feature description and expects the seven-point analysis.
- Do **not** implement the feature; only output the analysis.
