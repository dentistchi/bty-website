# BTY Patch Timer (Azure Function)

Weekly timer trigger that generates patch suggestions and optionally notifies admin Teams.

## Schedule

Runs every **Monday at 08:00 UTC** (NCRONTAB: `0 0 8 * * 1`).

## On trigger

1. Calls `generatePatchSuggestions("7d")`
2. Stores draft in `bty_patch_suggestions` (status=`draft`)
3. If `TEAMS_WEBHOOK_URL` is set, sends a summary to the admin Teams channel

## Setup

1. **Build bty-ai-core** first:
   ```bash
   cd bty-website/bty-ai-core && npm run build
   ```

2. **Install dependencies**:
   ```bash
   cd bty-website/bty-patch-timer && npm install
   ```

3. **Configure** `local.settings.json` (or Azure Application Settings):
   - `DATABASE_URL` – PostgreSQL connection string (same as bty-ai-core)
   - `OPENAI_API_KEY` – OpenAI API key
   - `TEAMS_WEBHOOK_URL` – (optional) Incoming webhook URL for Teams

4. **Run locally**:
   ```bash
   npm start
   ```

## Deploy to Azure

Deploy as a separate Function App. Ensure bty-ai-core is built before deployment and the output is included in the deployment package, or configure the build to include the dependency.
