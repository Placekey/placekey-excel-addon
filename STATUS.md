# Placekey Excel Add-in — Plan, Status, Next Steps

Handoff snapshot for picking up where we left off. The original porting plan is at `~/Documents/placekey-excel-addin-plan.md`.

## Current state

- **Version:** `1.0.0` (`package.json`); manifest `<Version>1.0.0.0</Version>` synced by `scripts/manifest-prod.js` at build.
- **Tests:** 189 passing across 8 Vitest suites (logic, client, edge-cases, integration, write-batching, api-client, ui-state, manifest-prod).
- **Coverage:** ~99% on pure logic modules. Adapter and taskpane.js have no tests (no Office.js mock).
- **Toolchain clean:** `lint`, `format:check`, `build`, `rewrite-manifest`, `validate-manifest` all pass.
- **Audit history:** 7 iterative audit-and-fix rounds (Opus agents) landed ~60 fixes. See git log once committed.

## Phases completed (from original plan)

| Phase                 | Status         | Notes                                                                                                                            |
| --------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Scaffolding       | Done           | Vite + Vitest + ESLint + Prettier + npm scripts                                                                                  |
| 1 — Logic port        | Done           | All pure logic as ESM modules under `src/logic/`                                                                                 |
| 2 — Office.js adapter | Done           | `src/sheet-adapter.js` — reads/writes via `context.sync()`                                                                       |
| 3 — Taskpane UI       | Done           | `src/taskpane.html/.js/.css`, `apikey.html/.js`                                                                                  |
| 4 — Generate flow     | Done           | Validate → batch → API → write; rate-limit + retry + error column                                                                |
| 5 — Persistence       | Done           | API key + learned aliases (`OfficeRuntime.storage`) + per-sheet mapping (`workbook.settings` keyed by `worksheet.id`)            |
| 6 — Distribution      | Done           | `publish.yml` → GitHub Pages; `release.yml` → GitHub Release with `manifest.xml` asset; `docs/install.html` served at Pages root |
| 7 — Polish + docs     | Partially done | README, CONTRIBUTING, CHANGELOG, install page, official Placekey icons. **Manual QA NOT done.**                                  |

## Hardening applied beyond plan

- SHA-pinned every GitHub Action with Dependabot-parseable `# vX.Y.Z` trailing comments
- Dependabot for npm + github-actions; dev-deps grouped
- CodeQL workflow (weekly + PR, security-extended queries)
- Lychee link checker for docs
- CI matrix Node 20 + 22; least-privilege `permissions: contents: read`
- Coverage artifact upload
- Per-sheet mappings keyed by `worksheet.id` (survives renames)
- XSS fix in `escapeHtml` (escapes `"` for attribute-safe option values)
- Autofit only output columns, not full used range
- `setGenerateLock` disables all interactive UI during generate
- Sample data as Excel Table (ListObject) with frozen header row
- `resolveSheet` id-fallback under sheet rename/delete race
- Pre-release semver refusal in `manifest-prod.js`
- `collectOverwriteHeaders` filters blank headers from overwrite confirm
- `handleGenerate` captures `{targetSheet, mappings}` before API-key dialog to close the dialog-race window

## Intentional divergences from Sheets (not bugs)

- API key + learned aliases: `OfficeRuntime.storage` (per-user, cross-workbook). Sheets uses per-document `DocumentProperties`; ours is strictly better.
- `escapeHtml` also escapes `"` (XSS fix).
- Geocode sub-field accessors use `value && value.location` + `?? ""` (safer than Sheets).
- Autofit only output columns (perf).
- `user-agent` header omitted (browsers forbid setting it).
- `prepareOutputFields` trims trailing empty headers before appending (`effectiveLength`).

## Next steps

### Must do before first release

1. **Confirm GitHub repo setup.** Repo is `Placekey/placekey-excel-addon`. Verify:
   - Pages is enabled with source `GitHub Actions` (Settings → Pages).
   - Optional `PLACEKEY_ADDIN_URL` repo variable only if the Pages URL differs from `https://placekey.github.io/placekey-excel-addon`.
   - Branch protection on `main` per `CONTRIBUTING.md` (required status checks: `test (20)`, `test (22)`, CodeQL `Analyze`).
2. **First commit.** Repo is currently only tracking `README.md` + `LICENSE`. Everything else is untracked. Needs an initial commit of the full tree (plus `.gitignore` which already excludes `node_modules`, `dist`, `coverage`).
3. **Manual QA in Excel for Web.** Sideload `manifest.xml`, run through:
   - Empty sheet → **Fill with sample data** → map columns (should auto-map) → **Generate** → verify Placekey column written, autofit correct.
   - Workbook with existing `Placekey` header → Generate → verify overwrite-confirm dialog shows the right columns, Cancel does NOT persist state.
   - Large workbook (>100 valid rows) → exercises batching + 1.1s rate-limit sleep between batches.
   - Malformed rows (missing lat/lng + missing address) + insert-error-column checkbox → verify error column populated for invalid rows only.
   - Sheet switch mid-generate (try Excel tab click with generate in flight) → should be no-op; UI lock holds.
   - Sheet rename mid-generate → `resolveSheet` id-fallback should still write to the correct sheet.
   - Headers containing quotes / `<script>` / `"` → XSS smoke test on dropdown population.
4. **Manual QA in Excel for Mac 16.44+.** Sideload via `~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/`, repeat above.
5. **First tag → release.** `npm version 1.0.0 && git push --follow-tags`.
   - `release.yml` creates a GitHub Release with `manifest.xml` attached.
   - `publish.yml` deploys `dist/` to Pages.
   - Verify `https://placekey.github.io/placekey-excel-addon/` serves `install.html` content and `manifest.xml` downloads.

### Optional follow-ups (punted, not blockers)

- **Vite HTTPS dev server.** Office sideload requires HTTPS; local dev currently needs a proxy/hack. Would require adding `@vitejs/plugin-basic-ssl`.
- **Adapter-layer tests.** 0 tests exercise `src/sheet-adapter.js`, `src/taskpane.js`, `src/prefs-storage.js`, `src/apikey.js`. Would need an Office.js mock.
- **In-taskpane Help panel.** Sheets version has one; Excel doesn't.
- **Strict-match API options** (`strict_address_match`, `strict_name_match`) — hardcoded `false` in `handleGenerate`. Legacy Excel repo exposed as checkboxes; we could too.
- **Cross-platform overwrite modal.** Currently uses `window.confirm` which renders inconsistently across Excel platforms. Could build an in-taskpane modal.
- **Adapter-layer harness.** A small Office.js proxy double would enable testing `readDataRows` / `writeResults` / `resolveSheet` edge cases.

## Key files to know

- `src/logic/` — pure ESM modules, verbatim-ported from Sheets (automap, validation, transform, api-client, edit-distance, html-helpers, ui-state, write-planner, constants).
- `src/sheet-adapter.js` — every Office.js interaction; `resolveSheet(context, {name, id})` handles rename/delete races.
- `src/taskpane.js` — orchestration; `state.isGenerating` lock prevents concurrent generates.
- `src/prefs-storage.js` — `OfficeRuntime.storage` wrapper; throws on storage failure.
- `manifest.xml` — dev URLs at `localhost:3000`; `scripts/manifest-prod.js` rewrites to Pages URL at build.
- `.github/workflows/` — `ci.yml`, `codeql.yml`, `publish.yml`, `release.yml`, `links.yml`. All SHA-pinned.

## Commands

```bash
npm install
npm test                  # 189 tests
npm run lint
npm run format:check
npm run build
npm run rewrite-manifest  # produces dist/manifest.xml
npm run validate-manifest
npm run dev               # local dev server (HTTP; see optional follow-up)
```

Release:

```bash
npm version 1.0.0         # bumps package.json and creates v1.0.0 tag
git push --follow-tags    # triggers publish.yml + release.yml
```
