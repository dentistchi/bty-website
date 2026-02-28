# BTY Arena MVP Content Pack

Content pack location: `bty-app/src/content/arena-mvp-content-pack.json`.

## Contents

| Pack | Title | Count | Intent |
|------|--------|-------|--------|
| `fundamental_arena_1` | Fundamental Arena 1 Set | 5 items | First set of situation–role–option items for staff-level Arena; builds pause-before-react and team-signal reflection. |
| `simulation_10` | Simulation 10 | 10 scenarios | Ten scenario-based simulations for the 7-step flow; practice observable choices and outcomes without judgment. |
| `recovery_quick_check_5` | Recovery Quick Check | 5 items | Short, repeatable prompts for post-run or daily recovery; notice and name only, no diagnosis. |

## Tone

- Non-judgmental, observational.
- Short, actionable, repeatable.
- No emotional or diagnostic language.

## Usage

- **Fundamental Arena 1**: Merge into `arena_program.json` under a track/level or consume as a standalone set. Structure: `situation`, `role`, `options`, `immediate_outcome`, `team_signal`.
- **Simulation 10**: Import into scenario source (e.g. `scenarios.ts`) or load from JSON. Schema matches `Scenario` (scenarioId, title, context, choices with result/microInsight). `hiddenDelta` is empty in this pack; fill from domain if needed.
- **Recovery Quick Check**: Render as post-run or daily checklist. Each item has `id`, `prompt`, `intent`.
