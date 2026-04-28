# Changelog

## [Unreleased]

## 1.1.2 — 2026-04-28

### Removed

- **Unused `commands.html` / `commands.js` placeholder** and the corresponding `<FunctionFile resid="Commands.Url"/>` + `<bt:Url id="Commands.Url">` entries from `manifest.xml`. `<FunctionFile>` is only required when a manifest Action uses `xsi:type="ExecuteFunction"`; our only Action is `ShowTaskpane`, so the placeholder was dead weight. Removed in preparation for Microsoft AppSource publishing — fewer surfaces for the validator to scrutinize. Vite `rollupOptions.input`, `README.md`, and `STATUS.md` were updated to match.
- **"Source on GitHub" link** from `docs/install.html` footer. The link pointed at a 404 (`Placekey/placekey-excel-addon` is not a public repo); AppSource validators also reject support links that point to source-host URLs.

## 1.1.1 — 2026-04-24

### Fixed

- **Surface per-row Placekey API failures in the error column.** Previously when a row in a 100-row bulk batch came back from the API with no Placekey (e.g. the address couldn't be matched, often because country was unmapped and silently sent as `US`), our response loop iterated `Object.entries` over `{ query_id, placekey: null, error: "..." }` and silently wrote nulls to the output cells. The `error` field from the API was dropped because our column key is `placekey_error`, not `error`. The row showed up blank and the error column showed up blank — no indication anything went wrong. Response handling is now a standalone `processBatchResponse(json, indexes, fields, insertError)` helper that covers all three API-side failure modes: a missing reply element, an explicit `error` field, and a null/empty `placekey` with no other signal. All three now write a clear message into the error column when "Add error column for invalid rows" is checked.
- **Remove the silent `iso_country_code` default of `US`.** `mapRowToObject` used to substitute `"US"` whenever the country column was unmapped, which produced meaningless Placekeys for non-US data (a Calgary address was being queried as "Calgary, Alberta, T3S0V3, US"). The default is gone: an unmapped country column now leaves the field empty, and address-based input sets (which all require `iso_country_code` in `MINIMUM_INPUTS`) fail validation with the existing "did not meet minimum input requirements" message. Pure lat/long rows still work without a country mapping. **Breaking for US-only users who never mapped the Country column** — they now need to add a Country column and map it. The mapping status chip will display "Need country" until they do.

## 1.1.0 — 2026-04-24

### Changed

- **Pipeline the Generate flow**. Previously the add-in read every row of the sheet into memory, validated them all, built every batch, and only then started calling the Placekey API. On a 500k-row workbook in Excel for the Web that meant ~12 minutes of blank staring before any Placekeys appeared. The flow is now streamed: a new `streamDataRows` async-generator in `sheet-adapter.js` yields `READ_CHUNK_ROWS` (100) rows at a time, and `taskpane.js` validates each chunk as it arrives, fills `API_BATCH_SIZE` (100) batches, and dispatches them to the Placekey API immediately. The next chunk's Office.js read is kicked off before awaiting the API response, so the Excel-read channel and the Placekey HTTPS channel run in parallel. First Placekeys land in the sheet within seconds of clicking Generate regardless of total sheet size.
- New `readDataHeaders` helper reads only row 1, so pre-flight work (overwrite-warning prompt, saving learned aliases / prefs / sheet mapping) no longer blocks on the data-row read.
- `readDataRows` is retained as a thin wrapper over `streamDataRows` for existing callers and tests; the single-`Excel.run`-many-syncs implementation has been replaced with per-chunk `Excel.run` invocations that use `worksheets.getItem(name)` directly (sync count unchanged, but context lifetime no longer ties up the Office.js channel during subsequent API + write work).

### CI

- `publish.yml` no longer triggers on GA version tags — the tag-triggered deploy was redundant (the same commit was already deployed by the preceding main-push run) and always failed the `github-pages` environment protection rule that restricts deployments to `main`. Pages now deploys exclusively from pushes to `main`. The `release.yml` workflow that creates the GitHub Release on tag push is unchanged.

## 1.0.3 — 2026-04-24

### Changed

- Removed the hard-coded 1.1 s client-side pause between Placekey API batches (`RATE_LIMIT_MS`). Generation now dispatches the next batch as soon as the previous response arrives. For a large sheet this eliminates ~1 s of forced wait per 100 rows (e.g. ~110 s saved on 10 000 valid rows).
- `callPlacekeyApi` now treats HTTP 429 as retryable instead of throwing immediately. On 429 it honors the server's `Retry-After` header (seconds or HTTP date), or falls back to `RETRY_AFTER_DEFAULT_MS` (2 s) when the header is absent, and retries up to `MAX_RETRIES` times before surfacing a rate-limit error.
- Results are now written back to the sheet as each API batch returns, instead of being accumulated in memory and written all at once at the end. `writeResults` gained an `autofit` option (default `true` for backward compatibility) and a new `autofitResultColumns` helper performs the single final autofit pass. The user sees Placekeys appearing in the sheet incrementally during long runs, rather than staring at a blank output region for the full duration.

### Security

- Add an npm `overrides` entry pinning `uuid` to `^14.0.0` to resolve [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) (missing buffer bounds check in uuid `v3`/`v5`/`v6`, fixed in 14.0.0). Reached us transitively through the `office-addin-manifest` dev dependency; not shipped to end users, but `npm audit` now reports zero vulnerabilities and Dependabot no longer errors out with "no patched version available".

## 1.0.2 — 2026-04-24

### Fixed

- Chunk sheet reads in 100-row slabs so large workbooks no longer trip Office.js's response-payload ceiling (`The response payload size has exceeded the limit.`). `readDataRows` now issues one `context.sync()` per 100-row slab instead of loading the entire used range in a single sync. `readActiveSheetInfoInContext` now only loads the header row (plus a small probe when row 1 is empty), rather than the full sheet, when populating the taskpane.

## 1.0.1 — 2026-04-24

### Added

- Taskpane dark mode: respects `prefers-color-scheme: dark` via a dark palette token set (#5).
- Build-version display in taskpane footer. Vite injects `__APP_VERSION__`, `__APP_COMMIT__`, and `__APP_BUILD_DATE__` as define globals rendered at the bottom of the sidebar (#10).
- `.lycheeignore` entry set for known pre-release link-check failures (#3).
- Explicit `@eslint/js` dev-dependency to satisfy ESLint 10's flat-config consumer requirement (#2).

### Fixed

- `resolveFieldValue` now respects an explicit `"— none —"` saved selection. Previously a field the user intentionally unmapped would get re-populated by auto-map on the next sheet load; now a saved `NO_INPUT_STRING` is honored and only a missing saved entry falls through to auto-map.

### Changed

- Dev-dependency major bumps: ESLint 9 → 10, Vitest 3 → 4, Vite 7 → 8, `@vitest/coverage-v8` 3 → 4, `office-addin-manifest` 1 → 2 (#2).
- `api-client` rethrow now forwards the original error via `{ cause }` per Node 20 / ES2022 idiom (#2).
- CI: Link Check runs on every PR, push to `main`, and manual dispatch (previously cron-only) (#4).
- Sideload documentation updated for Excel for Mac 16.108 and modern Excel for Web: Home-tab ribbon path, macOS quarantine xattr stripping guidance, and the Cmd+Q requirement (the Excel background process caches `wef` state). README test-count claim updated 189 → 226 and the CodeQL badge was swapped for the Link Check badge (#8).
- Footer brand SVG switched to `currentColor` so the wordmark adapts to dark mode (#6, later superseded by #9).
- Footer brand wordmark restored to the full Placekey mark from the Sheets add-on source (#9).

### Removed

- `.github/workflows/codeql.yml` — CodeQL is not available on this org and the workflow was failing on every run (#4).

## 1.0.0 — Initial Excel port

Port of the Placekey Google Sheets Add-on to an Excel Office Add-in (taskpane). Feature parity with the Sheets v0.0.9 release except:

- Distribution is via manifest sideload (GitHub Pages) rather than a copyable template workbook.

### Per-sheet mapping persistence

Per-sheet column mappings are stored in `workbook.settings` keyed by `worksheet.id`. The ID is stable across sheet renames, so saved mappings survive renames — equivalent to the Sheets add-on's `DocumentProperties`-keyed-by-sheetId behavior.

### Notable

- All ~130 auto-map aliases ported verbatim
- Fuzzy Levenshtein match (threshold scales with header length) ported verbatim
- 4 minimum-input rule sets ported verbatim
- API call shape and batch/rate-limit/retry behavior ported verbatim
- 189 Vitest tests pass (port of the Sheets suite — `logic`, `client`, `edge-cases`, `integration`, `write-batching`, plus new `api-client`, `ui-state`, and `manifest-prod`)
