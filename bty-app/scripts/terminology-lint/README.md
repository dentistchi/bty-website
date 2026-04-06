# Terminology lint (IB-TERMINOLOGY-LINT-01 / QA G-B11)

Single command: `npm run lint:terminology` (runs `node scripts/terminology-lint.mjs`).

## Lint source vs normative documents

- **CI / `terminology-lint.mjs` reads only** the four markdown files under **`bty-app/docs/terminology-locks/`** (see `LOCK_FILE_HEADINGS` in `terminology-lint.mjs`). Those copies are the **lint source**: the forbidden-substitution tables parsed for G-B11 are taken from here and nowhere else.
- The **normative** lock text may be defined or maintained in another place (e.g. a canonical spec doc, design repo, or governance packet). Regardless, the **`docs/terminology-locks/`** excerpts **must match** the approved normative sections (same § headings and table content). If they drift, CI enforces the wrong vocabulary.
- Details and file/section mapping: **`bty-app/docs/terminology-locks/README.md`**.

## What it does

1. Reads the **Forbidden Substitutions** column from the markdown tables in `docs/terminology-locks/` (four files; see that folder’s README).
2. Normalizes each comma-separated **fragment** (trim, collapse spaces, strip `**` markdown).
3. Splits **annotation** text from the forbidden cell when present (`**Annotation:**` in `VALIDATOR_ARCHITECTURE_V1.md` §6 **Escalate** row).
4. Scans the repo for **matches** and exits **1** on any hit.

## Tokenization rules

- **Delimiter:** commas in the Forbidden Substitutions cell (after removing the annotation suffix).
- **Trim:** leading/trailing whitespace on each fragment; internal runs of spaces collapsed to one.
- **Markdown:** `**` removed from fragments (table uses bold on terms).
- **Multi-word vs single-word (default):**  
  - **Default (CI):** only fragments that contain at least one **space** become rules (e.g. `Better Than You`, `try again`, `challenge rating`, `pending review`).  
  - **Rationale:** single tokens such as `status`, `tier`, `step`, or `review` appear in ordinary SQL/HTTP identifiers and produce mass false positives; they are **not** matched unless you opt into strict mode.
- **Strict singles:** `node scripts/terminology-lint.mjs --strict-singles` also enforces **single-word** fragments from the locks (audit / future tightening; expect large violation sets until renamed).

## Regex behavior

- **Single-word rules** (strict mode only): case-insensitive, ASCII word-adjacency via `(?<![A-Za-z0-9])…(?![A-Za-z0-9])`.
- **Multi-word rules:**  
  - Spaced form with flexible whitespace.  
  - **camelCase** and **snake_case** variants generated (e.g. `pending review` → `pendingReview`, `pending_review`).

## Annotation: Escalate / “pending review”

Per `VALIDATOR_ARCHITECTURE_V1.md` §6, the phrase **pending review** is forbidden in **system/API naming** only; user-facing procedural copy falls under `UX_FLOW_LOCK_V1.md` §3.

**Implementation:**

- Rules built from the phrase **`pending review`** (and its camel/snake variants) use scope **`system_api_naming`** only.
- **Scanned paths for that scope** are configured in `scripts/terminology-lint.config.json` → `systemApiNamingSubstrings` (migrations, `src/app/api`, `src/middleware.ts`, `src/lib/bty/validator`).
- **Not** scanned for that phrase: general UI / i18n string extraction paths, so neutral copy such as “pending review” in membership messaging is allowed.

Other fragments from the same cell (**Flag**, **review**, **hold**) are subject to the **default multi-word filter**; as single tokens they are **not** active unless `--strict-singles` is used.

## Scan scope (deployment bundle subset)

Configured in `terminology-lint.config.json`:

- **`supabase/migrations/**/*.sql`** — full line scan.
- **`src/**/*.{ts,tsx}`** — full line scan, except:
  - path excludes (`node_modules`, `.next`, tests, `docs/terminology-locks`, this script),
  - **narrative carve-outs** (`narrativeExcludeSubstrings`) for in-universe scenario blobs that are not product-chrome terminology.
- **`src/lib/i18n.ts`** — **English string values only** (characters inside double-quoted strings on each line), so key names like `retry` are not matched by phrase rules.

## CI

Workflow: `.github/workflows/terminology-lint.yml` — runs on `bty-app` changes; **blocking** (job must pass for G-B11).

## Maintenance — lock amendments (include a sync step)

Whenever terminology locks are **amended** (normative doc change, governance review, new forbidden term):

1. **Update the normative document** (authoritative spec / agreed §).
2. **Sync step (required):** Apply the same change to the matching file under **`bty-app/docs/terminology-locks/`** so the excerpted § and **Forbidden Substitutions** table(s) **match** the normative source. Do not rely on “we’ll copy later” — the linter only sees `docs/terminology-locks/`.
3. Run **`npm run lint:terminology`** until green; fix code/i18n or adjust the lock text per policy.

After any direct edit to `docs/terminology-locks/` only: still run **`npm run lint:terminology`** before merge.
