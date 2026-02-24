# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

BTY (Better Than Yesterday) is a multi-service dental education platform. The primary services are:

| Service | Directory | Port | Run command |
|---|---|---|---|
| **bty-app** (main Next.js app) | `bty-app/` | 3001 | `npm run dev` (runs on 3000 by default; use `-p 3001`) |
| **bty-ai-core** (Express API) | `bty-ai-core/` | 4000 | `npm run dev` |
| **today-me** (companion Next.js) | `today-me/` | 3000 | `npm run dev` |

The `bty-website/` directory contains older/duplicate copies of these services — always work with the root-level copies.

### Node version

The project requires **Node 20** (see `bty-app/.nvmrc`). Use `nvm use 20` before running any commands.

### Package manager

All sub-projects use **npm** (`package-lock.json` present in each).

### Environment variables

Each service needs a `.env` file — copy from `.env.example` in the respective directory. Key gotchas:

- `bty-app` prebuild script (`scripts/check-env.mjs`) checks `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` at build time via `process.env` (not loaded from `.env`). You must `export` them before running `npm run build`.
- `bty-ai-core` requires `OPENAI_API_KEY` to be non-empty at startup (the OpenAI SDK constructor throws if missing). Use a placeholder value like `sk-placeholder-for-local-dev` to start the server without a real key.
- Supabase-dependent features (auth, journey data) won't work without real Supabase credentials, but the UI still renders.

### Lint / Test / Build

- **Lint (bty-app):** `cd bty-app && npx next lint`
- **Build (bty-app):** `cd bty-app && export $(cat .env | grep -v '^#' | xargs) && npm run build`
- **Build (bty-ai-core):** `cd bty-ai-core && npx tsc`
- There are no automated test suites currently configured in any service.

### Running services

1. Start `bty-ai-core` first: `cd bty-ai-core && npm run dev`
2. Start `bty-app`: `cd bty-app && npx next dev -p 3001`
3. (Optional) Start `today-me`: `cd today-me && npm run dev`

### External dependencies

- **Supabase** (PostgreSQL + auth) — cloud hosted, required for auth/journey features
- **OpenAI API** — required for AI chat in bty-ai-core
- **Google Gemini API** — optional, powers Safe Mirror; falls back to fixed responses
- **Azure AD** — optional, for admin dashboard SSO
